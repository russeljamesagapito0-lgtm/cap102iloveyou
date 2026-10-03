from flask import Flask, request, jsonify
from flask_cors import CORS
import tensorflow as tf
import numpy as np
from PIL import Image, ImageFilter, ImageStat
import io
import base64
import os
import math
import logging
from datetime import datetime

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('server.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Accept"],
        "expose_headers": ["Content-Type", "Accept"],
        "supports_credentials": True
    }
})

@app.after_request
def after_request(response):
    response.headers.add('Cache-Control', 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0')
    response.headers.add('Pragma', 'no-cache')
    response.headers.add('Expires', '0')
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Accept')
    response.headers.add('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    return response

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'models', 'rootcare_cassava_model_resnet50v2.tflite')
IMAGE_SIZE = 224

CONFIDENCE_THRESHOLD = 0.65  
GREEN_RATIO_THRESHOLD = 0.15 
ENTROPY_THRESHOLD = 0.75  

CLASS_NAMES = [
    'Cassava Bacterial Blight (CBB)',
    'Cassava Brown Streak Disease (CBSD)',
    'Cassava Green Mottle (CGM)',
    'Cassava Mosaic Disease (CMD)',
    'Healthy'
]

CLASS_KEYS = ['CBB', 'CBSD', 'CGM', 'CMD', 'HEALTHY']

DISEASE_INFO = {
    'CBB': {
        'name': 'Cassava Bacterial Blight',
        'description': 'A bacterial disease causing angular, water-soaked leaf spots that turn brown and can lead to wilting and dieback.',
        'treatment': 'Remove and destroy infected plant parts. Apply copper-based bactericides and avoid working in fields when leaves are wet.',
        'prevention': 'Use certified disease-free planting material, practice crop rotation, and avoid overhead irrigation.',
        'severity': 'High',
        'symptoms': 'Angular water-soaked lesions, brown spots with yellow halos, wilting.'
    },
    'CBSD': {
        'name': 'Cassava Brown Streak Disease',
        'description': 'A viral disease that causes brown streaking on stems and a dry, corky brown rot inside the storage roots.',
        'treatment': 'Remove and destroy infected plants promptly. There is no cure once infected.',
        'prevention': 'Plant certified virus-free cuttings, control whitefly populations.',
        'severity': 'High',
        'symptoms': 'Brown streaking on stems, corky brown rot in roots.'
    },
    'CGM': {
        'name': 'Cassava Green Mottle',
        'description': 'Causes mottled, mosaic-like discoloration and mild distortion of leaves.',
        'treatment': 'Remove severely affected plants. Support plant health with balanced fertilization.',
        'prevention': 'Use resistant varieties and source planting material from healthy stock.',
        'severity': 'Medium',
        'symptoms': 'Mottled leaves, mild leaf distortion.'
    },
    'CMD': {
        'name': 'Cassava Mosaic Disease',
        'description': 'A viral disease that causes yellow mosaic patterns on leaves. Infected plants show stunted growth and reduced yield.',
        'treatment': 'Remove infected plants, use resistant varieties, control whitefly vectors.',
        'prevention': 'Plant certified disease-free cuttings, practice crop rotation.',
        'severity': 'High',
        'symptoms': 'Yellow mosaic patterns on leaves, stunted growth, distorted leaves.'
    },
    'HEALTHY': {
        'name': 'Healthy Cassava Leaf',
        'description': 'No signs of disease detected. The leaf shows normal color, shape, and growth patterns.',
        'treatment': 'No treatment needed. Continue regular monitoring and good agricultural practices.',
        'prevention': 'Maintain proper spacing, balanced fertilization, and routine field inspection.',
        'severity': 'None',
        'symptoms': 'No visible symptoms. Healthy green leaves with normal growth.'
    }
}

def convert_to_serializable(obj):
    """Convert NumPy types to Python native types for JSON serialization"""
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, bool):
        return bool(obj)
    elif isinstance(obj, dict):
        return {key: convert_to_serializable(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_to_serializable(item) for item in obj]
    else:
        return obj

logger.info("Loading TFLite model...")
try:
    interpreter = tf.lite.Interpreter(model_path=MODEL_PATH)
    interpreter.allocate_tensors()
    
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    
    logger.info(f"Model loaded successfully!")
    logger.info(f"Input shape: {input_details[0]['shape']}")
    logger.info(f"Output shape: {output_details[0]['shape']}")
except Exception as e:
    logger.error(f"Failed to load model: {str(e)}")
    raise e

def is_cassava_leaf_color(image):
    """Check for green color presence"""
    if image.mode != 'RGB':
        image = image.convert('RGB')
    
    pixels = np.array(image)
    r, g, b = pixels[:, :, 0], pixels[:, :, 1], pixels[:, :, 2]
    
    # Green: G > R and G > B and G > 50
    mask = (g > r) & (g > b) & (g > 50)
    green_ratio = np.sum(mask) / (pixels.shape[0] * pixels.shape[1])
    
    logger.debug(f"   🌿 Green ratio: {green_ratio:.2%}")
    return green_ratio > GREEN_RATIO_THRESHOLD

def calculate_entropy(probabilities):
    """Calculate prediction uncertainty"""
    eps = 1e-7
    probs = np.clip(probabilities, eps, 1.0)
    entropy = -np.sum(probs * np.log(probs))
    max_entropy = np.log(len(probs))
    normalized_entropy = entropy / max_entropy
    
    logger.debug(f"   Uncertainty: {normalized_entropy:.2%}")
    return normalized_entropy

def check_edge_density(image):
    """Check edge density using PIL"""
    gray = image.convert('L')
    edges = gray.filter(ImageFilter.FIND_EDGES)
    edge_array = np.array(edges)
    edge_density = np.sum(edge_array > 30) / (edge_array.shape[0] * edge_array.shape[1])
    
    logger.debug(f"   🔲 Edge density: {edge_density:.2%}")
    return edge_density > 0.02

def check_brightness_contrast(image):
    """Check image quality"""
    stat = ImageStat.Stat(image)
    brightness = stat.mean[0] / 255.0
    contrast = stat.stddev[0] / 255.0
    
    logger.debug(f"    Brightness: {brightness:.2%}, Contrast: {contrast:.2%}")
    return 0.10 < brightness < 0.95 and contrast > 0.05

def is_cassava_leaf_comprehensive(image, probabilities):
    """Combined detection using multiple methods"""
    logger.info(" Running cassava leaf detection...")
    
    is_green = is_cassava_leaf_color(image)
    entropy = calculate_entropy(probabilities)
    is_confident = entropy < ENTROPY_THRESHOLD
    has_edges = check_edge_density(image)
    has_good_quality = check_brightness_contrast(image)
    max_confidence = np.max(probabilities)
    is_confident_prediction = max_confidence > CONFIDENCE_THRESHOLD
    
    green_score = 1.0 if is_green else 0.0
    confidence_score = 1.0 if is_confident_prediction else 0.0
    entropy_score = 1.0 if is_confident else 0.0
    edge_score = 0.5 if has_edges else 0.0
    quality_score = 0.3 if has_good_quality else 0.0
    
    total_score = (green_score * 3.0) + (confidence_score * 2.0) + (entropy_score * 1.5) + (edge_score * 1.0) + (quality_score * 0.5)
    max_possible = 3.0 + 2.0 + 1.5 + 1.0 + 0.5
    overall_score = total_score / max_possible
    
    logger.info(f"    Overall score: {overall_score:.2%}")
    logger.info(f"    Green: {is_green}, Confident: {is_confident_prediction}, Certain: {is_confident}, Edges: {has_edges}, Quality: {has_good_quality}")
    
    is_cassava = overall_score >= 0.60
    
    if max_confidence < 0.30:
        logger.warning(f"    Very low confidence ({max_confidence:.2%}) - rejecting")
        is_cassava = False
    
    return is_cassava, {
        'is_green': bool(is_green),
        'is_confident': bool(is_confident_prediction),
        'is_certain': bool(is_confident),
        'has_edges': bool(has_edges),
        'has_good_quality': bool(has_good_quality),
        'overall_score': float(round(overall_score * 100, 2)),
        'entropy': float(round(entropy * 100, 2)),
        'max_confidence': float(round(max_confidence * 100, 2)),
        'green_ratio': float(round(green_score * 100, 2))
    }

def preprocess_image(image_data):
    """Convert base64 image to preprocessed tensor"""
    try:
        # Decode base64
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))

        if image.mode != 'RGB':
            image = image.convert('RGB')

        original_image = image.copy()
        image = image.resize((IMAGE_SIZE, IMAGE_SIZE))

        # ResNet50V2 preprocessing: scale from [0, 255] to [-1, 1]
        image_array = np.array(image, dtype=np.float32)
        image_array = (image_array / 127.5) - 1.0
        image_array = np.expand_dims(image_array, axis=0)

        return image_array, original_image
    except Exception as e:
        logger.error(f" Image preprocessing error: {str(e)}")
        raise e

@app.route('/predict', methods=['POST', 'OPTIONS'])
def predict():
    # Handle preflight request
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    try:
        logger.info("=" * 60)
        logger.info(" New prediction request received")
        logger.info(f" Client: {request.remote_addr}")
        logger.info(f" Content-Type: {request.headers.get('Content-Type')}")
        
        data = request.get_json()
        if not data:
            logger.error(" No JSON data received")
            return jsonify({'error': 'No JSON data provided'}), 400
        
        if 'image' not in data:
            logger.error(" No image in request")
            return jsonify({'error': 'No image provided'}), 400
        
        image_length = len(data['image'])
        logger.info(f" Image data length: {image_length} characters")
        
        if image_length < 100:
            logger.warning(" Image data seems too small")
            return jsonify({'error': 'Invalid image data'}), 400
        
        logger.info(" Preprocessing image...")
        image_tensor, original_image = preprocess_image(data['image'])
        
        logger.info(" Running model inference...")
        interpreter.set_tensor(input_details[0]['index'], image_tensor)
        interpreter.invoke()
        output = interpreter.get_tensor(output_details[0]['index'])
        
        probabilities = output[0]
        predicted_index = np.argmax(probabilities)
        confidence = float(probabilities[predicted_index])
        
        logger.info(f" Raw probabilities: {probabilities}")
        logger.info(f" Predicted index: {predicted_index}, Confidence: {confidence:.2%}")
        
        is_cassava, detection_metrics = is_cassava_leaf_comprehensive(original_image, probabilities)
        
        all_probabilities = {}
        for i in range(len(CLASS_KEYS)):
            all_probabilities[CLASS_KEYS[i]] = float(round(probabilities[i] * 100, 2))
        
        if not is_cassava:
            logger.warning(" Not a cassava leaf detected!")
            logger.info(f" Detection metrics: {detection_metrics}")
            return jsonify({
                'success': False,
                'error': 'not_cassava',
                'message': 'This does not appear to be a cassava leaf. Please upload a clear image of a cassava leaf.',
                'detection_metrics': detection_metrics,
                'confidence': float(round(confidence * 100, 2)),
                'allProbabilities': all_probabilities
            }), 200
        
        class_key = CLASS_KEYS[predicted_index]
        class_name = CLASS_NAMES[predicted_index]
        disease_info = DISEASE_INFO[class_key]
        
        logger.info(f" Cassava leaf confirmed!")
        logger.info(f" Prediction: {class_name} ({confidence:.2%})")
        logger.info(f" Detection metrics: {detection_metrics}")
        
        response_data = {
            'success': True,
            'diseaseKey': class_key,
            'diseaseName': class_name,
            'confidence': float(round(confidence * 100, 2)),
            'description': disease_info['description'],
            'treatment': disease_info['treatment'],
            'prevention': disease_info['prevention'],
            'severity': disease_info['severity'],
            'symptoms': disease_info['symptoms'],
            'detection_metrics': detection_metrics,
            'allProbabilities': all_probabilities
        }
        
        logger.info(" Response prepared successfully")
        logger.info("=" * 60)
        
        return jsonify(response_data)
        
    except base64.binascii.Error as e:
        logger.error(f" Base64 decoding error: {str(e)}")
        return jsonify({'error': 'Invalid image encoding'}), 400
    except Exception as e:
        logger.error(f" Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET', 'OPTIONS'])
def health():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    logger.info(" Health check requested")
    return jsonify({
        'status': 'healthy',
        'message': 'Model is ready!',
        'model': 'ResNet50V2',
        'image_size': f"{IMAGE_SIZE}x{IMAGE_SIZE}",
        'detection_methods': ['color', 'uncertainty', 'edge_density', 'quality_check'],
        'timestamp': datetime.now().isoformat(),
        'server': 'Flask + TensorFlow Lite'
    })

@app.route('/', methods=['GET'])
def root():
    return jsonify({
        'name': 'RootCare AI API',
        'version': '1.0.0',
        'endpoints': {
            '/': 'This page',
            '/health': 'Health check',
            '/predict': 'Predict disease from leaf image (POST)'
        },
        'status': 'running'
    })

if __name__ == '__main__':
    print("\n" + "=" * 60)
    print(" ROOTCARE AI SERVER STARTING")
    print("=" * 60)
    print(f" Model: ResNet50V2 (224x224)")
    print(f" Confidence threshold: {CONFIDENCE_THRESHOLD:.0%}")
    print(f" Green threshold: {GREEN_RATIO_THRESHOLD:.0%}")
    print(f" Entropy threshold: {ENTROPY_THRESHOLD:.0%}")
    print(" Detection: Color + Uncertainty + Edge + Quality")
    print("=" * 60)
    print(" Server will be available at:")
    print(f"   http://localhost:5000")
    print(f"   http://0.0.0.0:5000")
    print("=" * 60)
    print(" Available endpoints:")
    print("   GET  /        - Server info")
    print("   GET  /health  - Health check")
    print("   POST /predict - Predict disease")
    print("=" * 60)
    print("ℹ  Press Ctrl+C to stop the server")
    print("=" * 60 + "\n")
    
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True,
        threaded=True,
        use_reloader=True
    )