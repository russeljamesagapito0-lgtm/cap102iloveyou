import { supabase, logAudit } from './supabase';

export const DEFAULT_MAINTENANCE = {
  enabled: false,
  message: 'RootCare is undergoing scheduled maintenance. Please check back soon.',
  eta: null,
};

// Hardcoded for now. Add an entry here to make it show up on the Models page.
export const MODELS = [
  {
    id: 'convnext_384',
    name: 'ConvNeXt-384',
    file: 'rootcare_cassava_convnext_384.tflite',
    input: '384 × 384',
    classes: 5,
    notes: 'Current production model (online + offline).',
  },
  {
    id: 'resnet50v2_224',
    name: 'ResNet50V2-224',
    file: 'rootcare_cassava_model_resnet50v2.tflite',
    input: '224 × 224',
    classes: 5,
    notes: 'Previous model. Kept as a fallback.',
  },
];

export const DEFAULT_MODEL_ID = MODELS[0].id;

export async function getSetting(key) {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value, updated_at')
    .eq('key', key)
    .maybeSingle();
  if (error) throw error;
  return data; // null if the row does not exist yet
}

export async function saveSetting(key, value) {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw error;
}

export const auditSetting = (action, details) =>
  logAudit(action, 'app_settings', action.split('.')[0], details);