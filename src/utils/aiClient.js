import { File } from 'expo-file-system';
import { GoogleGenAI } from '@google/genai';
import { supabase } from './supabaseClient';

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-3.8-flash';

if (!API_KEY) {
  console.error('Missing EXPO_PUBLIC_GEMINI_API_KEY in .env');
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const RECENT_MESSAGE_LIMIT = 10;
const SCAN_CACHE_TTL_MS = 5 * 60_000;
const CHAT_THINKING_LEVEL = 'low';
const IMAGE_THINKING_LEVEL = 'low';

const SYSTEM_PROMPT = `You are RootCare Companion, a friendly, practical AI assistant for cassava and root crop farmers.

Guidelines:
- Give clear, actionable advice in simple English.
- When asked about a disease, structure your reply: Symptoms, Treatment, Prevention.
- Be concise, aim for 2-4 short paragraphs, not walls of text.
- Use plain language. Avoid scientific jargon unless the user asks for it.
- If the user sends an image of a leaf or crop, describe what you see and suggest possible diseases.
- If the user's question is outside farming or agriculture, politely steer back to root crop topics.
- Never invent pesticide names or dosages. Recommend general categories (for example, "copper-based fungicide") and suggest consulting a local agricultural officer for specifics.
- If scan history is provided, use it to personalize advice.`;

// ---- Scan history cache ----
let cachedScans = null;
let cachedScansAt = 0;
let inFlightScans = null;

const loadRecentScans = async (limit = 5) => {
  const now = Date.now();
  if (cachedScans && now - cachedScansAt < SCAN_CACHE_TTL_MS) {
    return cachedScans;
  }
  if (inFlightScans) return inFlightScans;

  inFlightScans = (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return [];

      const { data, error } = await supabase
        .from('scans')
        .select('disease_name, disease_type, severity, accuracy, captured_at')
        .eq('user_id', session.user.id)
        .eq('is_deleted', false)
        .order('captured_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.warn('Scan context load failed:', error.message);
        return [];
      }
      cachedScans = data || [];
      cachedScansAt = Date.now();
      return cachedScans;
    } catch {
      return [];
    } finally {
      inFlightScans = null;
    }
  })();

  return inFlightScans;
};

export const invalidateScanCache = () => {
  cachedScans = null;
  cachedScansAt = 0;
};

const buildScanContext = (scans) => {
  if (!scans || scans.length === 0) return '';
  const lines = scans.map((s) => {
    const date = new Date(s.captured_at).toLocaleDateString();
    return `- ${date}: ${s.disease_name || 'Unknown'} (${s.disease_type || 'N/A'}, severity: ${s.severity || 'N/A'}, accuracy: ${s.accuracy ?? '—'}%)`;
  });
  return `\n\nRecent scan history from this user (most recent first):\n${lines.join('\n')}`;
};

const buildInput = (conversation, userContent, contextBlock) => {
  const input = [
    {
      type: 'user_input',
      content: [{ type: 'text', text: SYSTEM_PROMPT + contextBlock }],
    },
    {
      type: 'model_output',
      content: [{ type: 'text', text: 'Understood. I am RootCare Companion.' }],
    },
  ];

  const recent = conversation.slice(-RECENT_MESSAGE_LIMIT);
  for (const msg of recent) {
    input.push({
      type: msg.sender === 'user' ? 'user_input' : 'model_output',
      content: [{ type: 'text', text: msg.text }],
    });
  }

  input.push({ type: 'user_input', content: userContent });
  return input;
};

const friendlyError = (error, fallback) => {
  const msg = error?.message || '';
  if (msg.includes('429') || msg.includes('rate')) {
    return 'I am receiving too many requests right now. Please wait a moment and try again.';
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return 'I could not reach the server. Please check your internet connection.';
  }
  if (msg.includes('401') || msg.includes('403')) {
    return 'The AI service is temporarily unavailable. Please try again later.';
  }
  return fallback;
};

export async function sendChatMessage(conversation, userMessage) {
  try {
    const scans = await loadRecentScans();
    const contextBlock = buildScanContext(scans);
    const input = buildInput(
      conversation,
      [{ type: 'text', text: userMessage }],
      contextBlock
    );

    const interaction = await ai.interactions.create({
      model: MODEL,
      input,
      generation_config: { thinking_level: CHAT_THINKING_LEVEL },
    });

    return {
      success: true,
      text: interaction.output_text || 'Sorry, I did not catch that.',
    };
  } catch (error) {
    console.error('AI chat error:', error);
    return { success: false, text: friendlyError(error, 'Sorry, something went wrong. Please try again.') };
  }
}

export async function sendChatMessageStream(conversation, userMessage, onToken) {
  try {
    const scans = await loadRecentScans();
    const contextBlock = buildScanContext(scans);
    const input = buildInput(
      conversation,
      [{ type: 'text', text: userMessage }],
      contextBlock
    );

    const stream = await ai.interactions.create({
      model: MODEL,
      input,
      generation_config: { thinking_level: CHAT_THINKING_LEVEL },
      stream: true,
    });

    let full = '';
    for await (const event of stream) {
      if (
        event?.event_type === 'step.delta' &&
        event?.delta?.type === 'text' &&
        typeof event.delta.text === 'string'
      ) {
        full += event.delta.text;
        onToken?.(event.delta.text);
      }
    }

    if (!full) full = 'Sorry, I did not catch that.';
    return { success: true, text: full };
  } catch (error) {
    console.error('AI chat stream error:', error);
    return { success: false, text: friendlyError(error, 'Sorry, something went wrong. Please try again.') };
  }
}

export async function sendChatWithImage(conversation, userMessage, imageUri) {
  try {
    const scans = await loadRecentScans();
    const contextBlock = buildScanContext(scans);

    const file = new File(imageUri);
    const base64 = await file.base64();

    const ext = (imageUri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

    const input = buildInput(
      conversation,
      [
        { type: 'text', text: userMessage || 'What is wrong with this crop?' },
        { type: 'image', data: base64, mime_type: mimeType },
      ],
      contextBlock
    );

    const interaction = await ai.interactions.create({
      model: MODEL,
      input,
      generation_config: { thinking_level: IMAGE_THINKING_LEVEL },
    });

    return {
      success: true,
      text: interaction.output_text || 'Sorry, I could not analyze that image.',
    };
  } catch (error) {
    console.error('AI image error:', error);
    return { success: false, text: friendlyError(error, 'Sorry, I could not analyze that image. Please try again.') };
  }
}

// ---- Crop scan (JSON output via Gemini 2.5 Vision) ----
export async function analyzeCropImage(imageUri) {
  try {
    const file = new File(imageUri);
    const base64 = await file.base64();

    const ext = (imageUri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

    const prompt = `You are a cassava disease expert. Analyze this leaf photo carefully.

Return ONLY a JSON object with these exact fields (no markdown, no code fences, no extra text):
{
  "disease_name": "string, full name of the disease or Healthy",
  "disease_type": "one of: Viral, Fungal, Bacterial, Pest, Healthy",
  "severity": "one of: High, Medium, Low, None",
  "confidence": number between 0 and 100,
  "description": "1-2 sentences explaining the diagnosis",
  "treatment": "1-2 sentences on how to treat it",
  "prevention": "1-2 sentences on prevention",
  "symptoms": "short string listing visible symptoms",
  "notes": "any extra observations, or empty string"
}`;

    const interaction = await ai.interactions.create({
      model: 'gemini-2.5-flash',
      input: [
        {
          type: 'user_input',
          content: [
            { type: 'text', text: prompt },
            { type: 'image', data: base64, mime_type: mimeType },
          ],
        },
      ],
    });

    const raw = interaction.output_text || '';
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON object found in AI response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      success: true,
      data: {
        disease_name: parsed.disease_name || 'Unknown',
        disease_type: parsed.disease_type || 'Unknown',
        severity: parsed.severity || 'None',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
        description: parsed.description || '',
        treatment: parsed.treatment || '',
        prevention: parsed.prevention || '',
        symptoms: parsed.symptoms || '',
        notes: parsed.notes || '',
      },
    };
  } catch (error) {
    console.error('Gemini scan error:', error);
    return { success: false, error: error?.message || 'Analysis failed' };
  }
}