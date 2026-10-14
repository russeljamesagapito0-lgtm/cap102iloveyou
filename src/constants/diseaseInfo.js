export const DISEASE_INFO = {
  bacterial_blight: {
    name: 'Cassava Bacterial Blight',
    description: 'A bacterial disease caused by Xanthomonas axonopodis pv. manihotis, affecting cassava leaves and stems.',
    treatment: 'Remove infected plants, use disease-free cuttings, apply copper-based bactericides.',
    prevention: 'Use resistant varieties, practice crop rotation, ensure proper field drainage.',
    severity: 'High',
    symptoms: 'Angular water-soaked spots on leaves, wilting, stem cankers, gum exudation.',
  },
  cassava_brown_streak: {
    name: 'Cassava Brown Streak Disease',
    description: 'A viral disease caused by Cassava brown streak virus, affecting root quality and yield.',
    treatment: 'No cure; remove infected plants immediately, use virus-free planting material.',
    prevention: 'Use resistant varieties, control whitefly vectors, practice strict field sanitation.',
    severity: 'High',
    symptoms: 'Chlorotic leaf spots, brown streaks on stems, root necrosis with brown lesions.',
  },
  green_mite: {
    name: 'Cassava Green Mite',
    description: 'A pest caused by Mononychellus tanajoa, feeding on cassava leaves and causing damage.',
    treatment: 'Apply acaricides, introduce predatory mites for biological control.',
    prevention: 'Use resistant varieties, maintain proper plant spacing, monitor mite populations.',
    severity: 'Medium',
    symptoms: 'Yellowing and bronzing of leaves, leaf distortion, web formation on undersides.',
  },
  cassava_mosaic: {
    name: 'Cassava Mosaic Disease',
    description: 'A viral disease caused by Cassava mosaic virus, transmitted by whiteflies.',
    treatment: 'No cure; remove infected plants, use resistant varieties, control whitefly populations.',
    prevention: 'Use resistant varieties, practice crop rotation, control weeds that harbor viruses.',
    severity: 'High',
    symptoms: 'Mosaic pattern on leaves, leaf distortion, stunted growth, reduced tuber size.',
  },
  brown_spot: {
    name: 'Cassava Brown Spot',
    description: 'A fungal disease causing brown lesions on cassava leaves, reducing photosynthesis and yield.',
    treatment: 'Apply copper-based or systemic fungicide, remove severely infected leaves.',
    prevention: 'Rotate crops, avoid overhead watering, ensure adequate plant spacing for airflow.',
    severity: 'Medium',
    symptoms: 'Circular brown spots with dark borders on leaves, sometimes with yellow halos.',
  },
  cassava_anthracnose: {
    name: 'Cassava Anthracnose',
    description: 'A fungal disease causing dark lesions on stems and leaves, favored by humid conditions.',
    treatment: 'Prune infected tissue, apply fungicide, improve field drainage.',
    prevention: 'Use clean planting material, avoid overcrowding, practice crop rotation.',
    severity: 'Medium',
    symptoms: 'Dark sunken lesions on stems, blighted shoot tips, leaf spotting.',
  },
  healthy: {
    name: 'Healthy Cassava',
    description: 'The plant shows no signs of disease or pest infestation.',
    treatment: 'Continue proper care and maintenance.',
    prevention: 'Maintain good agricultural practices, monitor regularly, ensure proper nutrition.',
    severity: 'Low',
    symptoms: 'Healthy green leaves, normal growth, no visible spots or deformities.',
  },
};

// Alias map: any code variant that might appear in the DB maps to a canonical key.
export const DISEASE_ALIASES = {
  CBB: 'bacterial_blight',
  CBSD: 'cassava_brown_streak',
  CGM: 'green_mite',
  CMD: 'cassava_mosaic',
  CAD: 'cassava_anthracnose',
  HEALTHY: 'healthy',
  cassava_green_mite: 'green_mite',
  cassava_green_mottle: 'green_mite',
};

// Helper: resolve any raw code to a DISEASE_INFO entry.
export const getDiseaseInfo = (raw) => {
  if (!raw) return null;
  const key = String(raw).trim();

  // Direct hit
  if (DISEASE_INFO[key]) return DISEASE_INFO[key];

  // Lowercase direct hit
  const lower = key.toLowerCase();
  if (DISEASE_INFO[lower]) return DISEASE_INFO[lower];

  // Alias lookup
  const aliased = DISEASE_ALIASES[key] || DISEASE_ALIASES[lower];
  if (aliased && DISEASE_INFO[aliased]) return DISEASE_INFO[aliased];

  return null;
};