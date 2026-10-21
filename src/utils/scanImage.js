import * as ImageManipulator from 'expo-image-manipulator';

export const SCAN_IMAGE_SIZE = 384;
export const SCAN_JPEG_QUALITY = 0.9;
export const prepareScanImage = async (uri, { centerCrop = false, cropFraction = 0.8 } = {}) => {
  const actions = [];

  if (centerCrop) {
    const { width: imgW, height: imgH } = await ImageManipulator.manipulateAsync(uri, [], {});
    const shortSide = Math.min(imgW, imgH);
    const cropSize = Math.round(shortSide * cropFraction);
    const originX = Math.round((imgW - cropSize) / 2);
    const originY = Math.round((imgH - cropSize) / 2);
    actions.push({ crop: { originX, originY, width: cropSize, height: cropSize } });
  }

  actions.push({ resize: { width: SCAN_IMAGE_SIZE, height: SCAN_IMAGE_SIZE } });

  const out = await ImageManipulator.manipulateAsync(uri, actions, {
    format: ImageManipulator.SaveFormat.JPEG,
    compress: SCAN_JPEG_QUALITY,
  });
  return { uri: out.uri, width: out.width, height: out.height };
};
