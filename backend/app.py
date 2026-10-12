from flask import Flask, request, jsonify
from flask_cors import CORS
import tensorflow as tf
import numpy as np
from PIL import Image, ImageFilter, ImageStat
import io
import base64
import binascii
import os
import logging
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('server.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Cap request size to 10 MB. Prevents OOM from a buggy or malicious client.
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024

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


MODEL_PATH = os.path.join(
    os.path.dirname(__file__),
    'models',
    'rootcare_cassava_convnext_384.tflite'
)
IMAGE_SIZE = 384

CONFIDENCE_THRESHOLD = 0.65
GREEN_RATIO_THRESHOLD = 0.15
MIN_MAX_CONFIDENCE = 0.30   # below this, always reject
MIN_OVERALL_SCORE = 0.60
EDGE_DENSITY_THRESHOLD = 0.05
MIN_BRIGHTNESS = 0.10
MAX_BRIGHTNESS = 0.95
MIN_CONTRAST = 0.05

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
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, bool):
        return bool(obj)
    if isinstance(obj, dict):
        return {k: convert_to_serializable(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [convert_to_serializable(x) for x in obj]
    return obj


logger.info("Loading TFLite model...")
try:
    interpreter = tf.lite.Interpreter(model_path=MODEL_PATH)
    interpreter.allocate_tensors()

    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()

    logger.info("Model loaded successfully!")
    logger.info(f"Input shape: {input_details[0]['shape']}")
    logger.info(f"Output shape: {output_details[0]['shape']}")
except Exception as e:
    logger.error(f"Failed to load model: {e}")
    raise


# ---------- Image analysis helpers ----------

def green_ratio(image):
    """Fraction of pixels that are strongly green."""
    if image.mode != 'RGB':
        image = image.convert('RGB')

    pixels = np.array(image)
    r = pixels[:, :, 0].astype(np.int32)
    g = pixels[:, :, 1].astype(np.int32)
    b = pixels[:, :, 2].astype(np.int32)

    mask = (g > r) & (g > b) & (g > 50)
    ratio = float(np.sum(mask)) / (pixels.shape[0] * pixels.shape[1])
    logger.debug(f"   Green ratio: {ratio:.2%}")
    return ratio


def edge_density(image):
    """Fraction of pixels that sit on an edge."""
    gray = image.convert('L')
    edges = gray.filter(ImageFilter.FIND_EDGES)
    arr = np.array(edges)
    density = float(np.sum(arr > 30)) / (arr.shape[0] * arr.shape[1])
    logger.debug(f"   Edge density: {density:.2%}")
    return density


def brightness_contrast(image):
    """Brightness and contrast measured on grayscale."""
    gray = image.convert('L')
    stat = ImageStat.Stat(gray)
    brightness = stat.mean[0] / 255.0
    contrast = stat.stddev[0] / 255.0
    logger.debug(f"   Brightness: {brightness:.2%}, Contrast: {contrast:.2%}")
    return brightness, contrast


def assess_cassava(image, probabilities):
    """
    Combines visual and model signals into a single confidence score.
    Returns (is_cassava, metrics_dict).

    Scoring weights are a heuristic — weighted green test first, then the
    model's own confidence, then supporting visual checks.
    """
    logger.info("Running cassava leaf detection...")

    gr = green_ratio(image)
    is_green = gr > GREEN_RATIO_THRESHOLD

    max_conf = float(np.max(probabilities))
    is_confident = max_conf > CONFIDENCE_THRESHOLD

    edge = edge_density(image)
    has_edges = edge > EDGE_DENSITY_THRESHOLD

    brightness, contrast = brightness_contrast(image)
    has_good_quality = (
        MIN_BRIGHTNESS < brightness < MAX_BRIGHTNESS
        and contrast > MIN_CONTRAST
    )

    # Weighted score — green matters most, then model confidence, then edges,
    # then overall image quality.
    green_score = 1.0 if is_green else 0.0
    confidence_score = 1.0 if is_confident else 0.0
    edge_score = 1.0 if has_edges else 0.0
    quality_score = 1.0 if has_good_quality else 0.0

    weights = {
        'green': 3.0,
        'confidence': 2.0,
        'edge': 1.0,
        'quality': 0.5,
    }
    total = (
        green_score * weights['green']
        + confidence_score * weights['confidence']
        + edge_score * weights['edge']
        + quality_score * weights['quality']
    )
    max_possible = sum(weights.values())
    overall = total / max_possible

    logger.info(f"   Overall score: {overall:.2%}")
    logger.info(
        f"   green={is_green} confident={is_confident} "
        f"edges={has_edges} quality={has_good_quality}"
    )

    is_cassava = overall >= MIN_OVERALL_SCORE

    # Hard floor: if the model itself is barely sure, don't accept.
    if max_conf < MIN_MAX_CONFIDENCE:
        logger.warning(f"   Very low confidence ({max_conf:.2%}) - rejecting")
        is_cassava = False

    metrics = {
        'is_green': bool(is_green),
        'is_confident': bool(is_confident),
        'has_edges': bool(has_edges),
        'has_good_quality': bool(has_good_quality),
        'overall_score': round(overall * 100, 2),
        'max_confidence': round(max_conf * 100, 2),
        'green_ratio': round(gr * 100, 2),
        'edge_density': round(edge * 100, 2),
        'brightness': round(brightness * 100, 2),
        'contrast': round(contrast * 100, 2),
    }
    return is_cassava, metrics


def preprocess_image(image_b64):
    """Decode base64, convert to RGB, resize, return (tensor, original_pil)."""
    image_bytes = base64.b64decode(image_b64)
    image = Image.open(io.BytesIO(image_bytes))

    if image.mode != 'RGB':
        image = image.convert('RGB')

    original = image.copy()

    resized = image.resize((IMAGE_SIZE, IMAGE_SIZE))
    arr = np.array(resized, dtype=np.float32)
    arr = np.expand_dims(arr, axis=0)

    return arr, original


# ---------- Routes ----------

@app.route('/predict', methods=['POST', 'OPTIONS'])
def predict():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    try:
        logger.info("=" * 60)
        logger.info("New prediction request")
        logger.info(f"Client: {request.remote_addr}")

        data = request.get_json(silent=True)
        if not data or 'image' not in data:
            logger.error("No image in request")
            return jsonify({'error': 'No image provided'}), 400

        image_b64 = data['image']
        if len(image_b64) < 100:
            logger.warning("Image data too small")
            return jsonify({'error': 'Invalid image data'}), 400

        logger.info(f"Image data length: {len(image_b64)} chars")

        try:
            tensor, original = preprocess_image(image_b64)
        except binascii.Error:
            logger.error("Base64 decoding failed")
            return jsonify({'error': 'Invalid image encoding'}), 400

        interpreter.set_tensor(input_details[0]['index'], tensor)
        interpreter.invoke()
        output = interpreter.get_tensor(output_details[0]['index'])

        probabilities = output[0]
        predicted_index = int(np.argmax(probabilities))
        confidence = float(probabilities[predicted_index])

        logger.info(f"Predicted index {predicted_index}, confidence {confidence:.2%}")

        is_cassava, metrics = assess_cassava(original, probabilities)

        all_probabilities = {
            CLASS_KEYS[i]: round(float(probabilities[i]) * 100, 2)
            for i in range(len(CLASS_KEYS))
        }

        if not is_cassava:
            logger.warning("Not a cassava leaf - rejecting")
            return jsonify({
                'success': False,
                'error': 'not_cassava',
                'message': 'This does not appear to be a cassava leaf. Please upload a clear image of a cassava leaf.',
                'detection_metrics': metrics,
                'confidence': round(confidence * 100, 2),
                'allProbabilities': all_probabilities
            }), 200

        class_key = CLASS_KEYS[predicted_index]
        class_name = CLASS_NAMES[predicted_index]
        info = DISEASE_INFO[class_key]

        logger.info(f"Accepted as cassava: {class_name} ({confidence:.2%})")

        return jsonify({
            'success': True,
            'diseaseKey': class_key,
            'diseaseName': class_name,
            'confidence': round(confidence * 100, 2),
            'description': info['description'],
            'treatment': info['treatment'],
            'prevention': info['prevention'],
            'severity': info['severity'],
            'symptoms': info['symptoms'],
            'detection_metrics': metrics,
            'allProbabilities': all_probabilities
        })

    except Exception as e:
        logger.error(f"Error handling request: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/health', methods=['GET', 'OPTIONS'])
def health():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    return jsonify({
        'status': 'healthy',
        'message': 'Model is ready',
        'model': 'ConvNeXt-384',
        'image_size': f"{IMAGE_SIZE}x{IMAGE_SIZE}",
        'detection_methods': ['color', 'confidence', 'edge_density', 'quality_check'],
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
    print("ROOTCARE AI SERVER STARTING")
    print("=" * 60)
    print(f"Model: ConvNeXt-384 ({IMAGE_SIZE}x{IMAGE_SIZE})")
    print(f"Confidence threshold: {CONFIDENCE_THRESHOLD:.0%}")
    print(f"Green threshold:      {GREEN_RATIO_THRESHOLD:.0%}")
    print(f"Edge threshold:       {EDGE_DENSITY_THRESHOLD:.0%}")
    print(f"Overall score floor:  {MIN_OVERALL_SCORE:.0%}")
    print("=" * 60)
    print("Endpoints:")
    print("  GET  /        - Server info")
    print("  GET  /health  - Health check")
    print("  POST /predict - Predict disease")
    print("=" * 60 + "\n")

    # debug=False so the Werkzeug debugger isn't exposed.
    # use_reloader=True in dev reloads on file save. Disable in production.
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=False,
        threaded=True,
        use_reloader=True
    )