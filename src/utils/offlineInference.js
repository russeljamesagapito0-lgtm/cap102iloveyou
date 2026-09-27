// src/utils/offlineInference.js
import { NitroModules } from 'react-native-nitro-modules';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { Buffer } from 'buffer';
import { Skia, ColorType, AlphaType } from '@shopify/react-native-skia';


// ===== CONFIG — mirrors backend/app.py =====
const IMAGE_SIZE = 224;
const CONFIDENCE_THRESHOLD = 0.65;
const GREEN_RATIO_THRESHOLD = 0.15;
const ENTROPY_THRESHOLD = 0.75;

const WEIGHTS = {
  green: 3.0,
  confidence: 2.0,
  entropy: 1.5,
  edges: 1.0,
  quality: 0.5,
};
const MAX_SCORE = WEIGHTS.green + WEIGHTS.confidence + WEIGHTS.entropy + WEIGHTS.edges + WEIGHTS.quality; // 8.0

// These MUST match backend/app.py's edge_score / quality_score multipliers
// (~line 209-210). Python only gives partial credit for these two checks —
// if you tune one side, tune both, or the online/offline gates will diverge again.
const EDGE_PARTIAL_CREDIT = 0.5;
const QUALITY_PARTIAL_CREDIT = 0.3;

const OVERALL_SCORE_THRESHOLD = 0.60; // must match app.py's `overall_score >= 0.60`
const MIN_CONFIDENCE_HARD_REJECT = 0.3;

const CLASS_KEYS = ['CBB', 'CBSD', 'CGM', 'CMD', 'HEALTHY'];
const CLASS_NAMES = [
  'Cassava Bacterial Blight (CBB)',
  'Cassava Brown Streak Disease (CBSD)',
  'Cassava Green Mottle (CGM)',
  'Cassava Mosaic Disease (CMD)',
  'Healthy',
];

const MODEL_FILENAME = 'rootcare_cassava_model_resnet50v2.tflite';
const LOCAL_MODEL_PATH = FileSystem.documentDirectory + MODEL_FILENAME;

let _model = null;
let _loading = null;

// ===== Load model once =====
export const loadOfflineModel = async () => {
  if (_model) return _model;
  if (_loading) return _loading;

  _loading = (async () => {
    try {
      const info = await FileSystem.getInfoAsync(LOCAL_MODEL_PATH);
      if (!info.exists) {
        console.log('📥 Copying model to documentDirectory...');
        const asset = Asset.fromModule(
          require('../assets/rootcare_cassava_model_resnet50v2.tflite')
        );
        await asset.downloadAsync();

        if (!asset.localUri) {
          throw new Error('Asset did not resolve to a local URI');
        }

        await FileSystem.copyAsync({
          from: asset.localUri,
          to: LOCAL_MODEL_PATH,
        });
        console.log('✅ Model copied to:', LOCAL_MODEL_PATH);
      } else {
        console.log('📦 Model already cached at:', LOCAL_MODEL_PATH);
      }

      console.log('📦 Reading model bytes into JS...');
      const base64 = await FileSystem.readAsStringAsync(LOCAL_MODEL_PATH, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const binaryString = Buffer.from(base64, 'base64').toString('binary');
      const arrayBuffer = new ArrayBuffer(binaryString.length);
      const view = new Uint8Array(arrayBuffer);
      for (let i = 0; i < binaryString.length; i++) {
        view[i] = binaryString.charCodeAt(i);
      }

      const tfliteModule = NitroModules.createHybridObject('TfliteModule');
      const model = tfliteModule.createModel(arrayBuffer, []);

      _model = model;
      console.log('✅ Offline TFLite model loaded');
      return model;
    } catch (e) {
      console.error('❌ Failed to load TFLite model:', e?.message || String(e));
      _loading = null;
      throw e;
    }
  })();

  return _loading;
};

const decodeImageNative = async (uri) => {
  const data = await Skia.Data.fromURI(uri);   // reads the file bytes
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) throw new Error('Skia failed to decode image');

  const width = image.width();
  const height = image.height();

  const pixels = image.readPixels(0, 0, {
    width,
    height,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  });

  image.dispose();
  data.dispose();

  if (!pixels) throw new Error('Skia readPixels returned null');
  return { data: pixels, width, height }; // Uint8Array RGBA — same shape jpeg-js gave you
};

// ===== Build Float32 tensor: (pixel/127.5) - 1.0, RGB =====
const buildInputTensor = (rgba224) => {
  const out = new Float32Array(IMAGE_SIZE * IMAGE_SIZE * 3);
  for (let i = 0, j = 0; i < rgba224.length; i += 4, j += 3) {
    out[j]     = rgba224[i]     / 127.5 - 1.0;
    out[j + 1] = rgba224[i + 1] / 127.5 - 1.0;
    out[j + 2] = rgba224[i + 2] / 127.5 - 1.0;
  }
  return out;
};

// ===== Detection helpers (mirror app.py) =====

// Green ratio — computed on the SAME resized image the model sees, so it
// reflects what actually got fed to the network (see note in analysis).
const computeGreenRatio = (rgba) => {
  let green = 0;
  const total = rgba.length / 4;
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    if (g > r && g > b && g > 50) green++;
  }
  return green / total;
};

// Normalized Shannon entropy
const computeEntropy = (probs) => {
  const eps = 1e-7;
  let H = 0;
  for (const p of probs) {
    const q = Math.min(Math.max(p, eps), 1.0);
    H -= q * Math.log(q);
  }
  return H / Math.log(probs.length);
};

// Ports backend/app.py's check_edge_density() exactly:
//   gray = image.convert('L')                       -> luma grayscale (ITU-R 601-2)
//   edges = gray.filter(ImageFilter.FIND_EDGES)      -> kernel [-1,-1,-1, -1,8,-1, -1,-1,-1]
//   edge_density = sum(edge_array > 30) / total_px
// PIL leaves the outer 1px border unfiltered (raw grayscale value, not run
// through the kernel) — that border is still included in the >30 count, so
// it's replicated here rather than cropped out.
const computeEdgeDensity = (rgba, w, h) => {
  const gray = new Float32Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    gray[p] = Math.round(rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114);
  }

  let count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      let v;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
        v = gray[p]; // border: unfiltered, matches PIL
      } else {
        v =
          -gray[p - w - 1] - gray[p - w] - gray[p - w + 1] +
          -gray[p - 1] + 8 * gray[p] - gray[p + 1] +
          -gray[p + w - 1] - gray[p + w] - gray[p + w + 1];
        v = Math.min(255, Math.max(0, v));
      }
      if (v > 30) count++;
    }
  }
  return count / (w * h);
};

// Brightness/contrast — matched to app.py's CURRENT (not "correct") definition:
// mean/stddev of the RED channel only, not true luma. This is a bug in the
// original Python code (ImageStat.Stat(image).mean[0] is just channel 0),
// but matching it here is what gives you online/offline parity today.
// If you fix app.py to use real luma, update this to match (0.299/0.587/0.114).
const computeBrightnessContrast = (rgba, w, h) => {
  let sum = 0, sumSq = 0;
  const n = w * h;
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i]; // red channel only, matches current app.py behavior
    sum += r;
    sumSq += r * r;
  }
  const mean = sum / n / 255;
  const variance = sumSq / n - (sum / n) ** 2;
  const stddev = Math.sqrt(Math.max(variance, 0)) / 255;
  return { brightness: mean, contrast: stddev };
};

// ===== Main pipeline =====
export const runOfflineInference = async (imageUri) => {
  const model = await loadOfflineModel();

  // 1. Resize + re-encode using the SAME call the online path uses before
  //    upload, so both paths hand the model pixel-equivalent input instead
  //    of two different resize algorithms operating on different source
  //    resolutions.
  const manipulated = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: IMAGE_SIZE, height: IMAGE_SIZE } }],
    { format: ImageManipulator.SaveFormat.JPEG, compress: 0.9, base64: true }
  );

  const base64 = manipulated.base64;
  if (!base64) {
    throw new Error('ImageManipulator did not return base64 data');
  }

  const { data: rgba, width, height } = await decodeImageNative(manipulated.uri);

  if (width !== IMAGE_SIZE || height !== IMAGE_SIZE) {
    console.warn(`⚠️ Manipulated image is ${width}x${height}, expected ${IMAGE_SIZE}x${IMAGE_SIZE}`);
  }

  // 3. Build input tensor directly from the resized image
  const input = buildInputTensor(rgba);

  // 4. Build a REAL ArrayBuffer (Hermes' .buffer may be polyfilled)
  const inputArrayBuffer = new ArrayBuffer(input.length * 4);
  const inputView = new Float32Array(inputArrayBuffer);
  inputView.set(input);

  // 5. Run inference
  const rawOutputs = await model.run([inputArrayBuffer]);

  // 6. Normalize the output into a plain array of numbers
  let probs;
  if (rawOutputs[0] instanceof Float32Array) {
    probs = Array.from(rawOutputs[0]);
  } else if (rawOutputs[0] instanceof ArrayBuffer) {
    probs = Array.from(new Float32Array(rawOutputs[0]));
  } else if (Array.isArray(rawOutputs[0])) {
    probs = rawOutputs[0];
  } else {
    probs = Array.from(rawOutputs[0] || []);
  }

  const predictedIndex = probs.indexOf(Math.max(...probs));
  const confidence = probs[predictedIndex];

  // 7. Detection gating — computed on the SAME 224x224 image the model saw
  const greenRatio = computeGreenRatio(rgba);
  const entropy = computeEntropy(probs);
  const edgeDensity = computeEdgeDensity(rgba, width, height);
  const { brightness, contrast } = computeBrightnessContrast(rgba, width, height);

  const isGreen = greenRatio > GREEN_RATIO_THRESHOLD;
  const isConfidentPred = confidence > CONFIDENCE_THRESHOLD;
  const isCertain = entropy < ENTROPY_THRESHOLD;
  const hasEdges = edgeDensity > 0.02;
  const hasGoodQuality = brightness > 0.10 && brightness < 0.95 && contrast > 0.05;

  const totalScore =
    (isGreen ? WEIGHTS.green : 0) +
    (isConfidentPred ? WEIGHTS.confidence : 0) +
    (isCertain ? WEIGHTS.entropy : 0) +
    (hasEdges ? EDGE_PARTIAL_CREDIT * WEIGHTS.edges : 0) +
    (hasGoodQuality ? QUALITY_PARTIAL_CREDIT * WEIGHTS.quality : 0);
  const overallScore = totalScore / MAX_SCORE;

  let isCassava = overallScore >= OVERALL_SCORE_THRESHOLD;
  if (confidence < MIN_CONFIDENCE_HARD_REJECT) isCassava = false;

  const allProbabilities = {};
  CLASS_KEYS.forEach((k, i) => {
    allProbabilities[k] = parseFloat(((probs[i] ?? 0) * 100).toFixed(2));
  });

  const detectionMetrics = {
    is_green: isGreen,
    is_confident: isConfidentPred,
    is_certain: isCertain,
    has_edges: hasEdges,
    has_good_quality: hasGoodQuality,
    overall_score: parseFloat((overallScore * 100).toFixed(2)),
    entropy: parseFloat((entropy * 100).toFixed(2)),
    max_confidence: parseFloat(((confidence || 0) * 100).toFixed(2)),
    green_ratio: parseFloat((greenRatio * 100).toFixed(2)),
  };

  console.log('🧠 Inference probs:', allProbabilities);
  console.log('🧠 Detection metrics:', detectionMetrics);

  if (!isCassava || !Number.isFinite(confidence)) {
    return {
      success: false,
      error: 'not_cassava',
      message: 'This does not appear to be a cassava leaf. Please upload a clear image of a cassava leaf.',
      detection_metrics: detectionMetrics,
      confidence: parseFloat(((confidence || 0) * 100).toFixed(2)),
      allProbabilities,
      _offline: true,
    };
  }

  return {
    success: true,
    diseaseKey: CLASS_KEYS[predictedIndex],
    diseaseName: CLASS_NAMES[predictedIndex],
    confidence: parseFloat((confidence * 100).toFixed(2)),
    detection_metrics: detectionMetrics,
    allProbabilities,
    _offline: true,
  };
};