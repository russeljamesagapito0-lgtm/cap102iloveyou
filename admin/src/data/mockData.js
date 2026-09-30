export const mockUser = { name: 'Admin User', email: 'admin@rootcare.app', role: 'admin' };

export const stats = {
  totalUsers: 248,
  activeUsers7d: 142,
  totalScans: 3187,
  scansToday: 47,
  pendingFeedback: 3,
  flaggedScans: 8,
  avgAccuracy: 0.92
};

export const scansPerDay = [
  { day: 'Mon', count: 210 },
  { day: 'Tue', count: 245 },
  { day: 'Wed', count: 190 },
  { day: 'Thu', count: 280 },
  { day: 'Fri', count: 320 },
  { day: 'Sat', count: 175 },
  { day: 'Sun', count: 140 }
];

export const diseaseBreakdown = [
  { name: 'Cassava Mosaic',   count: 820, color: '#ef4444' },
  { name: 'Bacterial Blight', count: 640, color: '#f97316' },
  { name: 'Brown Spot',       count: 510, color: '#eab308' },
  { name: 'Green Mite',       count: 420, color: '#84cc16' },
  { name: 'Anthracnose',      count: 310, color: '#06b6d4' },
  { name: 'Healthy',          count: 487, color: '#22c55e' }
];

export const users = [
  { id: 1, name: 'Juan Dela Cruz', email: 'juan@example.com', plan: 'free',    scans: 24,  lastActive: '2h ago',  status: 'active',    region: 'Laguna' },
  { id: 2, name: 'Maria Santos',   email: 'maria@example.com',plan: 'premium', scans: 87,  lastActive: '15m ago', status: 'active',    region: 'Batangas' },
  { id: 3, name: 'Pedro Reyes',    email: 'pedro@example.com',plan: 'free',    scans: 5,   lastActive: '3d ago',  status: 'active',    region: 'Cavite' },
  { id: 4, name: 'Ana Bautista',   email: 'ana@example.com',  plan: 'free',    scans: 42,  lastActive: '1h ago',  status: 'active',    region: 'Quezon' },
  { id: 5, name: 'Jose Rizal',     email: 'jose@example.com', plan: 'premium', scans: 156, lastActive: '5m ago',  status: 'active',    region: 'Manila' },
  { id: 6, name: 'Luzviminda Cruz',email: 'luz@example.com',  plan: 'free',    scans: 3,   lastActive: '1w ago',  status: 'suspended', region: 'Rizal' },
  { id: 7, name: 'Ramon Aquino',   email: 'ramon@example.com',plan: 'free',    scans: 18,  lastActive: '1d ago',  status: 'active',    region: 'Bulacan' },
  { id: 8, name: 'Corazon Aquino', email: 'cory@example.com', plan: 'premium', scans: 92,  lastActive: '30m ago', status: 'active',    region: 'Pampanga' }
];

export const scans = [
  { id: 1,  user: 'Maria Santos',   disease: 'Cassava Mosaic',   confidence: 0.96, date: '2025-01-15 09:12', flagged: false, region: 'Batangas' },
  { id: 2,  user: 'Juan Dela Cruz', disease: 'Brown Spot',       confidence: 0.45, date: '2025-01-15 08:40', flagged: true,  region: 'Laguna' },
  { id: 3,  user: 'Jose Rizal',     disease: 'Healthy',          confidence: 0.99, date: '2025-01-15 08:15', flagged: false, region: 'Manila' },
  { id: 4,  user: 'Ana Bautista',   disease: 'Bacterial Blight', confidence: 0.88, date: '2025-01-14 17:22', flagged: false, region: 'Quezon' },
  { id: 5,  user: 'Ramon Aquino',   disease: 'Green Mite',       confidence: 0.55, date: '2025-01-14 16:05', flagged: true,  region: 'Bulacan' },
  { id: 6,  user: 'Corazon Aquino', disease: 'Cassava Mosaic',   confidence: 0.91, date: '2025-01-14 14:30', flagged: false, region: 'Pampanga' },
  { id: 7,  user: 'Pedro Reyes',    disease: 'Anthracnose',      confidence: 0.72, date: '2025-01-14 11:50', flagged: false, region: 'Cavite' },
  { id: 8,  user: 'Maria Santos',   disease: 'Brown Spot',       confidence: 0.58, date: '2025-01-14 10:20', flagged: true,  region: 'Batangas' },
  { id: 9,  user: 'Jose Rizal',     disease: 'Healthy',          confidence: 0.97, date: '2025-01-13 19:05', flagged: false, region: 'Manila' },
  { id: 10, user: 'Juan Dela Cruz', disease: 'Bacterial Blight', confidence: 0.83, date: '2025-01-13 15:45', flagged: false, region: 'Laguna' },
  { id: 11, user: 'Ana Bautista',   disease: 'Green Mite',       confidence: 0.49, date: '2025-01-13 12:10', flagged: true,  region: 'Quezon' },
  { id: 12, user: 'Ramon Aquino',   disease: 'Cassava Mosaic',   confidence: 0.94, date: '2025-01-13 09:00', flagged: false, region: 'Bulacan' }
];

export const diseases = [
  {
    id: 1, code: 'cassava_mosaic', name: 'Cassava Mosaic Disease', type: 'Viral', severity: 'High',
    symptoms: 'Yellow-green mosaic patterns on leaves, leaf distortion, stunted growth.',
    treatment: 'Remove and destroy infected plants. Use resistant varieties. Control whitefly vectors.',
    prevention: 'Plant certified disease-free cuttings. Rogue out infected plants early.',
    published: true, updated: '2025-01-10'
  },
  {
    id: 2, code: 'bacterial_blight', name: 'Cassava Bacterial Blight', type: 'Bacterial', severity: 'High',
    symptoms: 'Angular water-soaked leaf spots, wilting, gum exudate on stems.',
    treatment: 'Apply copper-based bactericide. Prune infected parts. Improve drainage.',
    prevention: 'Crop rotation. Use disease-free planting material. Avoid overhead irrigation.',
    published: true, updated: '2025-01-08'
  },
  {
    id: 3, code: 'brown_spot', name: 'Cassava Brown Spot', type: 'Fungal', severity: 'Medium',
    symptoms: 'Brown circular spots with yellow halos on older leaves.',
    treatment: 'Fungicide application. Remove severely infected leaves.',
    prevention: 'Proper spacing for airflow. Balanced fertilization. Avoid wetting foliage.',
    published: true, updated: '2025-01-05'
  },
  {
    id: 4, code: 'green_mite', name: 'Cassava Green Mite', type: 'Pest', severity: 'Medium',
    symptoms: 'Yellow speckling on leaves, tiny webs, stunted new growth.',
    treatment: 'Miticide spray. Introduce predatory mites. Neem oil application.',
    prevention: 'Monitor during dry season. Maintain plant vigor. Avoid dusty conditions.',
    published: true, updated: '2024-12-28'
  },
  {
    id: 5, code: 'anthracnose', name: 'Cassava Anthracnose', type: 'Fungal', severity: 'Medium',
    symptoms: 'Dark sunken lesions on stems, dieback of shoots, leaf spots.',
    treatment: 'Prune affected stems. Apply fungicide during wet season.',
    prevention: 'Resistant varieties. Clean tools between plants. Proper drainage.',
    published: false, updated: '2024-12-20'
  },
  {
    id: 6, code: 'healthy', name: 'Healthy Cassava', type: 'N/A', severity: 'None',
    symptoms: 'Uniform green leaves, no spots or discoloration, vigorous growth.',
    treatment: 'Continue current care routine.',
    prevention: 'Regular monitoring and good agricultural practices.',
    published: true, updated: '2024-12-15'
  }
];

export const feedback = [
  { id: 1, user: 'Juan Dela Cruz',  category: 'accuracy', subject: 'Wrong diagnosis', message: 'The app said my cassava has Bacterial Blight but my neighbor (an agronomist) said it is Brown Spot.', status: 'open',      date: '2025-01-15 08:30', reply: null },
  { id: 2, user: 'Maria Santos',    category: 'feature',  subject: 'Offline mode',    message: 'Can you add a way to see my past scans when I have no internet?',                                  status: 'open',      date: '2025-01-14 17:45', reply: null },
  { id: 3, user: 'Pedro Reyes',     category: 'bug',      subject: 'App crashes',     message: 'The scanner crashes when I take a photo in low light.',                                            status: 'in_review', date: '2025-01-14 10:10', reply: 'Thanks for reporting, we are investigating.' },
  { id: 4, user: 'Ana Bautista',    category: 'general',  subject: 'Thank you',       message: 'This app saved my cassava farm. Thank you so much.',                                              status: 'resolved',  date: '2025-01-13 20:00', reply: 'You are welcome, Ana. Happy farming!' },
  { id: 5, user: 'Jose Rizal',      category: 'feature',  subject: 'Add more crops',  message: 'Can you add corn and rice next?',                                                                  status: 'open',      date: '2025-01-13 12:30', reply: null },
  { id: 6, user: 'Luzviminda Cruz', category: 'abuse',    subject: 'Spam user',       message: 'User "xX_farmer_Xx" keeps uploading fake images.',                                                status: 'open',      date: '2025-01-12 09:00', reply: null }
];

export const recentActivity = [
  { id: 1, type: 'user',     text: 'New user registered: Corazon Aquino',      time: '5m ago' },
  { id: 2, type: 'scan',     text: 'Low-confidence scan flagged for review',    time: '18m ago' },
  { id: 3, type: 'feedback', text: 'New feedback from Juan Dela Cruz',          time: '42m ago' },
  { id: 4, type: 'user',     text: 'User Luzviminda Cruz suspended',            time: '1h ago' },
  { id: 5, type: 'content',  text: 'Disease info updated: Cassava Mosaic',      time: '3h ago' }
];