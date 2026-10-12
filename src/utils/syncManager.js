import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabaseClient';
import { DISEASE_INFO } from '../constants/diseaseInfo';

// Constants for storage keys
const QUEUE_KEY = 'rootcare_sync_queue';
const CACHE_KEY = 'rootcare_scan_cache';

export const SCAN_BUCKET = 'plant-scans';
// Set to true ONLY if the `plant-scans` bucket is public in the Supabase dashboard.
// When false, scans.image_url stays null and the admin panel creates signed URLs
// from scans.image_path. (Admin handles both cases.)
const SCAN_BUCKET_IS_PUBLIC = false;

const PENDING_DIR = `${FileSystem.documentDirectory}pending-scans/`;
const pendingImagePathFor = (scanId) => `${PENDING_DIR}${scanId}.jpg`;

// Real UUID v4. Valid whether scans.id is `uuid` or `text`.
export const generateScanId = () => {
  const c = globalThis?.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

// ---------- queue storage (all writes serialized through one lock) ----------

let queueLock = Promise.resolve();
const withQueueLock = (fn) => {
  const run = queueLock.then(fn, fn);
  queueLock = run.catch(() => {});
  return run;
};

const loadQueue = async () => {
  try {
    const data = await AsyncStorage.getItem(QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    if (__DEV__) console.log('[queue] load skipped:', error?.message);
    return [];
  }
};

const saveQueue = async (queue) => {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    if (__DEV__) console.log('[queue] save skipped:', error?.message);
  }
};

const deleteLocalFile = async (path) => {
  if (!path) return;
  try {
    await FileSystem.deleteAsync(path, { idempotent: true });
  } catch (error) {
    if (__DEV__) console.log('[queue] file delete skipped:', error?.message);
  }
};

// Remove exactly one queued item (matched by identity), without touching the rest.
const removeMutation = (mutation) =>
  withQueueLock(async () => {
    const queue = await loadQueue();
    await saveQueue(
      queue.filter(
        (item) =>
          !(item.type === mutation.type &&
            item.scanId === mutation.scanId &&
            item.createdAt === mutation.createdAt)
      )
    );
  });

const bumpAttempts = (mutation, errorMessage) =>
  withQueueLock(async () => {
    const queue = await loadQueue();
    const idx = queue.findIndex(
      (item) =>
        item.type === mutation.type &&
        item.scanId === mutation.scanId &&
        item.createdAt === mutation.createdAt
    );
    if (idx !== -1) {
      queue[idx] = {
        ...queue[idx],
        attempts: (queue[idx].attempts || 0) + 1,
        lastError: String(errorMessage || '').slice(0, 200),
      };
      await saveQueue(queue);
    }
  });

// Enqueue mutation with dedup/collapse rules
export const enqueueMutation = async (mutation) =>
  withQueueLock(async () => {
    const queue = await loadQueue();
    const { type, scanId } = mutation;
    const fresh = { ...mutation, createdAt: Date.now(), attempts: 0 };

    // DELETE_FOREVER: drop every other pending mutation (and pending image) for this scan
    if (type === 'DELETE_FOREVER') {
      const dropped = queue.filter((item) => item.scanId === scanId);
      for (const item of dropped) {
        if (item.type === 'CREATE_SCAN') await deleteLocalFile(item.payload?.localImagePath);
      }
      const filtered = queue.filter((item) => item.scanId !== scanId);
      filtered.push(fresh);
      await saveQueue(filtered);
      return mutation;
    }

    // CREATE_SCAN: one per scanId (pressing Save twice replaces, never duplicates)
    // State mutations: replace existing same-type for same scanId
    const existingIndex = queue.findIndex(
      (item) => item.scanId === scanId && item.type === type
    );
    if (existingIndex !== -1) queue[existingIndex] = fresh;
    else queue.push(fresh);

    await saveQueue(queue);
    return fresh;
  });

// ---------- offline-first scan save ----------

const toConfidence01 = (accuracyPercent) => {
  const n = typeof accuracyPercent === 'number' ? accuracyPercent : parseFloat(accuracyPercent);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(1, n / 100));
};

/**
 * Saves a scan LOCALLY first: copies the 384x384 JPEG into documentDirectory/pending-scans
 * and enqueues one CREATE_SCAN mutation (file path only, never base64).
 * Does not touch the network. Call flushQueue() afterwards if online.
 *
 * scan: { scanId?, preparedImageUri, userId, cropType, diseaseCode, diseaseName, diseaseType,
 *         severity, accuracy (0..100), description, treatment, prevention, symptoms, capturedAt }
 */
export const savePendingScan = async (scan) => {
  const scanId = scan.scanId || generateScanId();

  let localImagePath = null;
  if (scan.preparedImageUri) {
    await FileSystem.makeDirectoryAsync(PENDING_DIR, { intermediates: true });
    localImagePath = pendingImagePathFor(scanId);
    await FileSystem.deleteAsync(localImagePath, { idempotent: true });
    await FileSystem.copyAsync({ from: scan.preparedImageUri, to: localImagePath });
  }

  await enqueueMutation({
    type: 'CREATE_SCAN',
    scanId,
    payload: {
      userId: scan.userId,
      localImagePath,
      cropType: scan.cropType || 'Cassava',
      capturedAt: scan.capturedAt || new Date().toISOString(),
      diseaseCode: scan.diseaseCode || null,
      diseaseName: scan.diseaseName || null,
      diseaseType: scan.diseaseType || null,
      severity: scan.severity || null,
      accuracy: typeof scan.accuracy === 'number' ? scan.accuracy : null,
      confidence: toConfidence01(scan.accuracy),
      description: scan.description || null,
      treatment: scan.treatment || null,
      prevention: scan.prevention || null,
      symptoms: scan.symptoms || null,
    },
  });

  return { scanId, localImagePath };
};

// ---------- flush ----------

const isNetworkError = (error) => {
  const msg = String(error?.message || error || '').toLowerCase();
  return (
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('connection') ||
    msg.includes('failed to fetch') ||
    msg.includes('offline')
  );
};

const MAX_STATE_MUTATION_ATTEMPTS = 5;

const runFlush = async () => {
  const result = { flushed: 0, failed: 0, remaining: 0, stoppedOnNetwork: false };

  // getSession reads the locally stored session (no network round-trip)
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  const queue = await loadQueue();
  if (!user) {
    result.remaining = queue.length;
    return result;
  }

  const blockedScanIds = new Set(); // a failed CREATE_SCAN blocks later mutations for that scan

  for (const mutation of queue) {
    // Never upload one account's pending scan under another account
    if (mutation.type === 'CREATE_SCAN' && mutation.payload?.userId &&
        mutation.payload.userId !== user.id) {
      result.remaining++;
      continue;
    }
    if (blockedScanIds.has(mutation.scanId)) {
      result.remaining++;
      continue;
    }

    try {
      await processMutation(mutation, user.id);
      await removeMutation(mutation);
      result.flushed++;
    } catch (error) {
      if (isNetworkError(error)) {
        result.stoppedOnNetwork = true;
        result.remaining += 1;
        break; // keep everything from here on, try again on next trigger
      }

      if (__DEV__) console.log('[queue] mutation failed:', mutation?.type, error?.message);
      result.failed++;

      if (mutation.type === 'CREATE_SCAN') {
        // The local file is the only copy: never drop it. Keep and retry next flush.
        blockedScanIds.add(mutation.scanId);
        await bumpAttempts(mutation, error?.message);
        result.remaining++;
      } else if ((mutation.attempts || 0) + 1 >= MAX_STATE_MUTATION_ATTEMPTS) {
        await removeMutation(mutation); // state toggles are safe to give up on
      } else {
        await bumpAttempts(mutation, error?.message);
        result.remaining++;
      }
    }
  }

  return result;
};

// Only one flush at a time. If someone asks while one is running, run once more afterwards
// so an item enqueued mid-flush is not left waiting for the next trigger.
let flushPromise = null;
let flushRequested = false;

export const flushQueue = () => {
  if (flushPromise) {
    flushRequested = true;
    return flushPromise;
  }
  flushPromise = (async () => {
    const total = { flushed: 0, failed: 0, remaining: 0 };
    try {
      do {
        flushRequested = false;
        const r = await runFlush();
        total.flushed += r.flushed;
        total.failed += r.failed;
        total.remaining = r.remaining;
        if (r.stoppedOnNetwork) break;
      } while (flushRequested);
      return total;
    } finally {
      flushPromise = null;
    }
  })();
  return flushPromise;
};

// Process individual mutation
const processMutation = async (mutation, userId) => {
  const { type, scanId, payload } = mutation;

  const run = async (query) => {
    const { error } = await query;
    if (error) throw error;
  };

  switch (type) {
    case 'CREATE_SCAN':
      await processCreateScan(mutation, userId);
      break;
    case 'SET_SAVED':
      await run(supabase.from('scans').update({ is_saved: payload.isSaved }).eq('id', scanId).eq('user_id', userId));
      break;
    case 'SET_ARCHIVED':
      await run(
        supabase.from('scans').update({
          is_archived: payload.isArchived,
          archived_at: payload.isArchived ? new Date().toISOString() : null,
        }).eq('id', scanId).eq('user_id', userId)
      );
      break;
    case 'SET_DELETED':
      await run(
        supabase.from('scans').update({
          is_deleted: payload.isDeleted,
          deleted_at: payload.isDeleted ? new Date().toISOString() : null,
          is_archived: payload.isDeleted ? false : undefined,
        }).eq('id', scanId).eq('user_id', userId)
      );
      break;
    case 'DELETE_FOREVER':
      await processDeleteForever(scanId, userId);
      break;
    case 'UPDATE_NOTES':
      await run(supabase.from('scans').update({ notes: payload.notes }).eq('id', scanId).eq('user_id', userId));
      break;
  }
};

// CREATE_SCAN: idempotent + retry-safe.
//   1. upload (upsert:true)  2. upsert scans row on id  3. only then delete local file
// (the caller removes the queue item after this resolves)
const processCreateScan = async (mutation, userId) => {
  const { scanId, payload } = mutation;

  // Items queued by the old flow (base64 in AsyncStorage, created at scan time) have no
  // localImagePath. They were never "Saved" by the user, so they are discarded.
  if (!payload || !('localImagePath' in payload)) {
    if (__DEV__) console.log('[queue] discarding legacy CREATE_SCAN', scanId);
    return;
  }

  const imagePath = `${userId}/${scanId}.jpg`;
  let hasImage = false;

  if (payload.localImagePath) {
    const info = await FileSystem.getInfoAsync(payload.localImagePath);
    if (info.exists) {
      const base64 = await FileSystem.readAsStringAsync(payload.localImagePath, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const { error: uploadError } = await supabase.storage
        .from(SCAN_BUCKET)
        .upload(imagePath, decode(base64), {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: true,
        });
      if (uploadError) throw uploadError;
      hasImage = true;
    } else {
      // File is gone (e.g. crash after a previous successful run, before the queue item
      // was removed). If the row already has its image there is nothing left to do.
      const { data: existing, error: lookupError } = await supabase
        .from('scans')
        .select('id, image_path')
        .eq('id', scanId)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (existing?.image_path === imagePath) return;
    }
  }

  const imageUrl =
    hasImage && SCAN_BUCKET_IS_PUBLIC
      ? supabase.storage.from(SCAN_BUCKET).getPublicUrl(imagePath).data.publicUrl
      : null;

  const row = {
    id: scanId,
    user_id: userId,
    crop_type: payload.cropType,
    captured_at: payload.capturedAt || new Date().toISOString(),
    is_saved: true,
    is_archived: false,
    is_deleted: false,
    disease_code: payload.diseaseCode,
    disease_name: payload.diseaseName,
    disease_type: payload.diseaseType,
    severity: payload.severity,
    accuracy: payload.accuracy,
    confidence: payload.confidence,
    description: payload.description,
    treatment: payload.treatment,
    prevention: payload.prevention,
    symptoms: payload.symptoms,
  };
  if (hasImage) {
    row.image_path = imagePath;
    row.image_url = imageUrl;
  }

  const { error: scanError } = await supabase.from('scans').upsert(row, { onConflict: 'id' });
  if (scanError) throw scanError;

  await deleteLocalFile(payload.localImagePath);
};

// Rows from `scans` hold image_path = storage path (new) or a local file:// URI (old rows).
// Returns copies whose image_path is something <Image source={{uri}}> can display.
export const resolveScanImageUris = async (rows) => {
  const out = (rows || []).map((r) => ({ ...r }));
  const isStoragePath = (p) => p && !/^(file|content|https?):/i.test(p);
  const targets = out.filter((r) => isStoragePath(r.image_path));
  if (!targets.length) return out;

  if (SCAN_BUCKET_IS_PUBLIC) {
    targets.forEach((r) => {
      r.image_path = supabase.storage.from(SCAN_BUCKET).getPublicUrl(r.image_path).data.publicUrl;
    });
    return out;
  }

  try {
    const { data, error } = await supabase.storage
      .from(SCAN_BUCKET)
      .createSignedUrls(targets.map((r) => r.image_path), 3600);
    if (error) throw error;
    const byPath = new Map((data || []).map((d) => [d.path, d.signedUrl]));
    targets.forEach((r) => { r.image_path = byPath.get(r.image_path) || null; });
  } catch (e) {
    if (__DEV__) console.log('[images] signing skipped:', e?.message);
    targets.forEach((r) => { r.image_path = null; }); // offline: show placeholder
  }
  return out;
};

// Removes storage object + any pending local file / queued mutations for these scans.
// Best effort on storage so a DB delete that already succeeded is never reported as failed.
export const removeScanAssets = async (scanIds, userIdOverride) => {
  const ids = (Array.isArray(scanIds) ? scanIds : [scanIds]).filter(Boolean);
  if (!ids.length) return;

  // pending local files + queued CREATE_SCAN for these scans
  await withQueueLock(async () => {
    const queue = await loadQueue();
    const keep = [];
    for (const item of queue) {
      if (ids.includes(item.scanId) && item.type !== 'DELETE_FOREVER') {
        if (item.type === 'CREATE_SCAN') await deleteLocalFile(item.payload?.localImagePath);
        continue;
      }
      keep.push(item);
    }
    await saveQueue(keep);
  });
  await Promise.all(ids.map((id) => deleteLocalFile(pendingImagePathFor(id))));

  let userId = userIdOverride;
  if (!userId) {
    const { data: { session } } = await supabase.auth.getSession();
    userId = session?.user?.id;
  }
  if (!userId) return;

  const { error } = await supabase.storage
    .from(SCAN_BUCKET)
    .remove(ids.map((id) => `${userId}/${id}.jpg`)); // removing a missing object is a no-op
  if (error) throw error;
};

// DELETE_FOREVER: storage object, pending local file, plant_results, then the scans row
const processDeleteForever = async (scanId, userId) => {
  const { data: scan, error: fetchError } = await supabase
    .from('scans')
    .select('image_path')
    .eq('id', scanId)
    .eq('user_id', userId)
    .maybeSingle();
  if (fetchError) throw fetchError;

  // Real storage paths look like `${userId}/${scanId}.jpg`; old rows hold local file:// URIs
  const paths = new Set([`${userId}/${scanId}.jpg`]);
  if (scan?.image_path && !/^(file|content|https?):/i.test(scan.image_path)) {
    paths.add(scan.image_path);
  }

  const { error: storageError } = await supabase.storage.from(SCAN_BUCKET).remove([...paths]);
  if (storageError) throw storageError;

  await deleteLocalFile(pendingImagePathFor(scanId));

  // plant_results.scan_id has a FOREIGN KEY to scans(id) with NO cascade, so any result row
  // must go first or the scans delete is rejected. (Best effort: there may be none.)
  const { error: resultsError } = await supabase.from('plant_results').delete().eq('scan_id', scanId);
  if (resultsError && __DEV__) console.log('[queue] plant_results cleanup skipped:', resultsError.message);

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