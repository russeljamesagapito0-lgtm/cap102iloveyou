import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabaseClient';
import { DISEASE_INFO } from '../constants/diseaseInfo';

// Constants for storage keys
const QUEUE_KEY = 'rootcare_sync_queue';
const CACHE_KEY = 'rootcare_scan_cache';

// Generate unique ID for scans
export const generateScanId = () => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}_${random}`;
};

// Load queue from AsyncStorage
const loadQueue = async () => {
  try {
    const data = await AsyncStorage.getItem(QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    if (__DEV__) console.log('[queue] load skipped:', error?.message);
    return [];
  }
};

// Save queue to AsyncStorage
const saveQueue = async (queue) => {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    if (__DEV__) console.log('[queue] save skipped:', error?.message);
  }
};

// Enqueue mutation with dedup/collapse rules
export const enqueueMutation = async (mutation) => {
  const queue = await loadQueue();
  const { type, scanId } = mutation;

  // Handle DELETE_FOREVER: remove all other mutations for this scanId
  if (type === 'DELETE_FOREVER') {
    const filtered = queue.filter(item => item.scanId !== scanId);
    filtered.push({ ...mutation, createdAt: Date.now(), attempts: 0 });
    await saveQueue(filtered);
    return mutation;
  }

  // Handle CREATE_SCAN: always add new
  if (type === 'CREATE_SCAN') {
    queue.push({ ...mutation, createdAt: Date.now(), attempts: 0 });
    await saveQueue(queue);
    return mutation;
  }

  // Handle state mutations: replace existing same-type for same scanId
  const existingIndex = queue.findIndex(
    item => item.scanId === scanId && item.type === type
  );

  const newMutation = { ...mutation, createdAt: Date.now(), attempts: 0 };

  if (existingIndex !== -1) {
    queue[existingIndex] = newMutation;
  } else {
    queue.push(newMutation);
  }

  await saveQueue(queue);
  return newMutation;
};

// Flush queue to Supabase
export const flushQueue = async () => {
  const queue = await loadQueue();
  let flushed = 0;
  let failed = 0;
  const remaining = [];

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { flushed, failed, remaining: queue.length };
  }

  for (let i = 0; i < queue.length; i++) {
    const mutation = queue[i];
    try {
      await processMutation(mutation, user.id);
      flushed++;
    } catch (error) {
      // Check if it's a network error
      if (error.message?.includes('network') || 
          error.message?.includes('timeout') ||
          error.message?.includes('connection')) {
        // Network failure: stop processing, keep remaining
        remaining.push(...queue.slice(i));
        await saveQueue(remaining);
        return { flushed, failed, remaining: remaining.length };
      } else {
        // Other error: log quietly, drop this mutation, continue
        if (__DEV__) console.log('[queue] mutation failed:', mutation?.type, error?.message);
        failed++;
      }
    }
  }

  // Save remaining queue (should be empty if all succeeded)
  await saveQueue(remaining);
  return { flushed, failed, remaining: remaining.length };
};

// Process individual mutation
const processMutation = async (mutation, userId) => {
  const { type, scanId, payload } = mutation;

  switch (type) {
    case 'CREATE_SCAN':
      await processCreateScan(mutation, userId);
      break;
    case 'SET_SAVED':
      await supabase
        .from('scans')
        .update({ is_saved: payload.isSaved })
        .eq('id', scanId)
        .eq('user_id', userId);
      break;
    case 'SET_ARCHIVED':
      await supabase
        .from('scans')
        .update({
          is_archived: payload.isArchived,
          archived_at: payload.isArchived ? new Date().toISOString() : null
        })
        .eq('id', scanId)
        .eq('user_id', userId);
      break;
    case 'SET_DELETED':
      await supabase
        .from('scans')
        .update({
          is_deleted: payload.isDeleted,
          deleted_at: payload.isDeleted ? new Date().toISOString() : null,
          is_archived: payload.isDeleted ? false : undefined
        })
        .eq('id', scanId)
        .eq('user_id', userId);
      break;
    case 'DELETE_FOREVER':
      await processDeleteForever(scanId, userId);
      break;
    case 'UPDATE_NOTES':
      await supabase
        .from('scans')
        .update({ notes: payload.notes })
        .eq('id', scanId)
        .eq('user_id', userId);
      break;
  }
};

// Process CREATE_SCAN with image upload
const processCreateScan = async (mutation, userId) => {
  const { scanId, payload } = mutation;
  const { imageBase64, cropType, capturedAt, diagnosisCode, confidence, modelVersion, inferredAt } = payload;

  // Convert base64 to ArrayBuffer
  const imageBuffer = decode(imageBase64);

  // Upload to storage
  const imagePath = `${userId}/${scanId}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from('plant-scans')
    .upload(imagePath, imageBuffer, {
      contentType: 'image/jpeg',
      cacheControl: '3600'
    });

  if (uploadError) throw uploadError;

  // Insert scan
  const { error: scanError } = await supabase
    .from('scans')
    .insert({
      id: scanId,
      user_id: userId,
      crop_type: cropType,
      image_path: imagePath,
      captured_at: capturedAt || new Date().toISOString()
    });

  if (scanError) throw scanError;

  // Insert plant result
  const { error: resultError } = await supabase
    .from('plant_results')
    .insert({
      scan_id: scanId,
      user_id: userId,
      diagnosis_code: diagnosisCode,
      confidence: confidence,
      model_version: modelVersion,
      inferred_at: inferredAt || new Date().toISOString()
    });

  if (resultError) throw resultError;
};

// Process DELETE_FOREVER
const processDeleteForever = async (scanId, userId) => {
  // Fetch image_path first
  const { data: scan, error: fetchError } = await supabase
    .from('scans')
    .select('image_path')
    .eq('id', scanId)
    .eq('user_id', userId)
    .single();

  if (fetchError) throw fetchError;

  // Delete from storage
  if (scan?.image_path) {
    const { error: storageError } = await supabase.storage
      .from('plant-scans')
      .remove([scan.image_path]);

    if (storageError) throw storageError;
  }

  // Delete from scans (plant_results cascades)
  const { error: deleteError } = await supabase
    .from('scans')
    .delete()
    .eq('id', scanId)
    .eq('user_id', userId);

  if (deleteError) throw deleteError;
};

// Fetch and cache scans with pending mutations overlay
export const fetchAndCacheScans = async (userId) => {
  // Fetch from Supabase with joined data
  const { data: scans, error } = await supabase
    .from('scans')
    .select(`
      *,
      plant_results (*)
    `)
    .eq('user_id', userId)
    .eq('is_deleted', false);

  if (error) throw error;

  // Load pending mutations
  const queue = await loadQueue();

  // Build result with disease info and apply pending mutations
  const result = scans.map(scan => {
    const plantResult = scan.plant_results?.[0] || {};
    const diseaseInfo = DISEASE_INFO[plantResult.diagnosis_code] || null;

    let enrichedScan = {
      ...scan,
      diagnosis: plantResult.diagnosis_code,
      confidence: plantResult.confidence,
      modelVersion: plantResult.model_version,
      inferredAt: plantResult.inferred_at,
      diseaseInfo
    };

    // Apply pending mutations
    const pendingMutations = queue.filter(m => m.scanId === scan.id);
    pendingMutations.forEach(m => {
      switch (m.type) {
        case 'SET_SAVED':
          enrichedScan.is_saved = m.payload.isSaved;
          break;
        case 'SET_ARCHIVED':
          enrichedScan.is_archived = m.payload.isArchived;
          enrichedScan.archived_at = m.payload.isArchived ? new Date().toISOString() : null;
          break;
        case 'SET_DELETED':
          enrichedScan.is_deleted = m.payload.isDeleted;
          enrichedScan.deleted_at = m.payload.isDeleted ? new Date().toISOString() : null;
          if (m.payload.isDeleted) {
            enrichedScan.is_archived = false;
          }
          break;
        case 'UPDATE_NOTES':
          enrichedScan.notes = m.payload.notes;
          break;
      }
    });

    return enrichedScan;
  });

  // Cache the result
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(result));
  return result;
};

// Get cached scans
export const getCachedScans = async () => {
  try {
    const data = await AsyncStorage.getItem(CACHE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    if (__DEV__) console.log('[cache] get skipped:', error?.message);
    return [];
  }
};

// Subscribe to connectivity changes
export const subscribeToConnectivity = (onOnline) => {
  let wasConnected = false;

  return NetInfo.addEventListener((state) => {
    const isConnected = state.isConnected && state.isInternetReachable !== false;
    
    if (isConnected && !wasConnected) {
      onOnline();
    }
    
    wasConnected = isConnected;
  });
};