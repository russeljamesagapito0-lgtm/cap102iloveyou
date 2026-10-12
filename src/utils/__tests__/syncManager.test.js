import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabaseClient';
import {
  generateScanId,
  enqueueMutation,
  flushQueue,
  fetchAndCacheScans,
  getCachedScans
} from '../syncManager';

// Mock dependencies with proper AsyncStorage implementation
jest.mock('@react-native-async-storage/async-storage', () => {
  let storage = {};
  return {
    setItem: jest.fn((key, value) => {
      storage[key] = value;
      return Promise.resolve();
    }),
    getItem: jest.fn((key) => {
      return Promise.resolve(storage[key] || null);
    }),
    removeItem: jest.fn((key) => {
      delete storage[key];
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      storage = {};
      return Promise.resolve();
    }),
    getAllKeys: jest.fn(() => Promise.resolve(Object.keys(storage))),
    multiGet: jest.fn(() => Promise.resolve([])),
    multiSet: jest.fn(() => Promise.resolve()),
    multiRemove: jest.fn(() => Promise.resolve()),
  };
});

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => ({
    unsubscribe: jest.fn()
  }))
}));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  EncodingType: { Base64: 'base64' },
  makeDirectoryAsync: jest.fn(() => Promise.resolve()),
  copyAsync: jest.fn(() => Promise.resolve()),
  deleteAsync: jest.fn(() => Promise.resolve()),
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: true })),
  readAsStringAsync: jest.fn(() => Promise.resolve('AAAA')),
}));

jest.mock('base64-arraybuffer', () => ({
  decode: jest.fn(() => new ArrayBuffer(8))
}));

// Mock supabase with proper implementation
jest.mock('../supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: jest.fn()
    },
    from: jest.fn(),
    storage: {
      from: jest.fn()
    }
  }
}));

describe('Sync Manager', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    
    // Setup default mock implementations
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'test_user' } } }
    });
    
    // Mock successful storage operations
    supabase.storage.from.mockReturnValue({
      upload: jest.fn().mockResolvedValue({ error: null }),
      remove: jest.fn().mockResolvedValue({ error: null })
    });
  });

  test('1. enqueueMutation persists a mutation to AsyncStorage', async () => {
    const mutation = {
      type: 'CREATE_SCAN',
      scanId: 'test_scan_123',
      payload: { test: 'data' }
    };

    await enqueueMutation(mutation);
    const queue = JSON.parse(await AsyncStorage.getItem('rootcare_sync_queue'));
    
    expect(queue).toHaveLength(1);
    expect(queue[0].type).toBe('CREATE_SCAN');
    expect(queue[0].scanId).toBe('test_scan_123');
  });

  test('2. Enqueueing SET_SAVED(true) then SET_SAVED(false) collapses', async () => {
    const scanId = 'scan_456';
    
    await enqueueMutation({
      type: 'SET_SAVED',
      scanId,
      payload: { isSaved: true }
    });
    
    await enqueueMutation({
      type: 'SET_SAVED',
      scanId,
      payload: { isSaved: false }
    });

    const queue = JSON.parse(await AsyncStorage.getItem('rootcare_sync_queue'));
    expect(queue).toHaveLength(1);
    expect(queue[0].payload.isSaved).toBe(false);
  });

  test('3. DELETE_FOREVER removes other mutations for the same scanId', async () => {
    const scanId = 'scan_789';
    
    await enqueueMutation({
      type: 'SET_SAVED',
      scanId,
      payload: { isSaved: true }
    });
    
    await enqueueMutation({
      type: 'UPDATE_NOTES',
      scanId,
      payload: { notes: 'test note' }
    });
    
    await enqueueMutation({
      type: 'DELETE_FOREVER',
      scanId,
      payload: {}
    });

    const queue = JSON.parse(await AsyncStorage.getItem('rootcare_sync_queue'));
    expect(queue).toHaveLength(1);
    expect(queue[0].type).toBe('DELETE_FOREVER');
  });

    test('4. flushQueue() successfully empties queue', async () => {
    // Chainable + "thenable" builder, matching how the real Supabase
    // query builder behaves: .delete()/.update() return the builder
    // itself so .eq() can be chained after them, and awaiting the
    // builder at the end of any chain resolves it.
    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockResolvedValue({ error: null }),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { image_path: 'test/path.jpg' },
        error: null
      }),
      then: jest.fn((resolve) => resolve({ data: null, error: null }))
    };

    supabase.from.mockReturnValue(mockQueryBuilder);

    await enqueueMutation({
      type: 'DELETE_FOREVER',
      scanId: 'test_scan',
      payload: {}
    });

    const result = await flushQueue();
    expect(result.flushed).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.remaining).toBe(0);

    const queue = await AsyncStorage.getItem('rootcare_sync_queue');
    expect(JSON.parse(queue)).toHaveLength(0);
  });

  test('5. flushQueue() leaves mutation on network error', async () => {
    // Create a mock that simulates network error with specific message
    const networkError = new Error('Network request failed');
    // Make sure it has the right message format that flushQueue checks
    networkError.message = 'Network request failed'; // real RN message (capital N)
    
    // Mock the from method to return a query builder that fails
    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockRejectedValue(networkError),
      delete: jest.fn().mockRejectedValue(networkError),
      update: jest.fn().mockRejectedValue(networkError)
    };
    
    supabase.from.mockReturnValue(mockQueryBuilder);

    // Add a mutation to the queue
    await enqueueMutation({
      type: 'DELETE_FOREVER',
      scanId: 'test_scan',
      payload: {}
    });

    const result = await flushQueue();
    expect(result.flushed).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.remaining).toBe(1);

    const queue = JSON.parse(await AsyncStorage.getItem('rootcare_sync_queue'));
    expect(queue).toHaveLength(1);
  });

  test('6. fetchAndCacheScans() overlays pending mutations', async () => {
    const userId = 'test_user';
    const scanId = 'scan_123';

    const mockScan = {
      id: scanId,
      user_id: userId,
      crop_type: 'cassava',
      is_archived: false,
      is_saved: false,
      is_deleted: false,
      plant_results: [{
        diagnosis_code: 'CBB',
        confidence: 0.95
      }]
    };

    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
    };
    
    // For fetchAndCacheScans, we need two eq calls
    // First eq for user_id, second eq for is_deleted
    mockQueryBuilder.eq.mockReturnValueOnce(mockQueryBuilder);
    mockQueryBuilder.eq.mockResolvedValueOnce({
      data: [mockScan],
      error: null
    });
    
    supabase.from.mockReturnValue(mockQueryBuilder);

    await enqueueMutation({
      type: 'SET_ARCHIVED',
      scanId,
      payload: { isArchived: true }
    });

    const result = await fetchAndCacheScans(userId);
    
    expect(result[0].is_archived).toBe(true);
    expect(result[0].is_saved).toBe(false);
    
    const cached = JSON.parse(await AsyncStorage.getItem('rootcare_scan_cache'));
    expect(cached[0].is_archived).toBe(true);
  });

  describe('CREATE_SCAN (offline-first image save)', () => {
    const FileSystem = require('expo-file-system/legacy');
    const { savePendingScan } = require('../syncManager');

    const mockScansBuilder = (upsertImpl) => {
      const builder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        upsert: jest.fn(upsertImpl || (() => Promise.resolve({ error: null }))),
      };
      supabase.from.mockReturnValue(builder);
      return builder;
    };

    const baseScan = (scanId) => ({
      scanId,
      userId: 'test_user',
      preparedImageUri: 'file:///cache/prepared.jpg',
      diseaseCode: 'CMD',
      diseaseName: 'Cassava Mosaic Disease',
      accuracy: 93.5,
    });

    test('7. savePendingScan copies file, queues file path (no base64), confidence 0..1', async () => {
      await savePendingScan(baseScan('scan_a'));
      expect(FileSystem.copyAsync).toHaveBeenCalledWith({
        from: 'file:///cache/prepared.jpg',
        to: 'file:///docs/pending-scans/scan_a.jpg',
      });
      const queue = JSON.parse(await AsyncStorage.getItem('rootcare_sync_queue'));
      expect(queue).toHaveLength(1);
      expect(queue[0].payload.localImagePath).toBe('file:///docs/pending-scans/scan_a.jpg');
      expect(queue[0].payload.imageBase64).toBeUndefined();
      expect(queue[0].payload.confidence).toBeCloseTo(0.935);
    });

    test('8. saving the same scanId twice keeps ONE queue item', async () => {
      await savePendingScan(baseScan('scan_b'));
      await savePendingScan(baseScan('scan_b'));
      const queue = JSON.parse(await AsyncStorage.getItem('rootcare_sync_queue'));
      expect(queue).toHaveLength(1);
    });

    test('9. flush uploads with upsert:true, upserts row, then deletes file and queue item', async () => {
      const upload = jest.fn().mockResolvedValue({ error: null });
      supabase.storage.from.mockReturnValue({ upload, remove: jest.fn() });
      const builder = mockScansBuilder();

      await savePendingScan(baseScan('scan_c'));
      const result = await flushQueue();

      expect(result.flushed).toBe(1);
      expect(upload).toHaveBeenCalledWith(
        'test_user/scan_c.jpg', expect.anything(), expect.objectContaining({ upsert: true })
      );
      expect(builder.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'scan_c', image_path: 'test_user/scan_c.jpg' }),
        { onConflict: 'id' }
      );
      expect(FileSystem.deleteAsync).toHaveBeenLastCalledWith(
        'file:///docs/pending-scans/scan_c.jpg', { idempotent: true }
      );
      expect(JSON.parse(await AsyncStorage.getItem('rootcare_sync_queue'))).toHaveLength(0);
    });

    test('10. upload ok but row upsert fails -> item and local file kept; retry uses upsert (no duplicate)', async () => {
      const upload = jest.fn().mockResolvedValue({ error: null });
      supabase.storage.from.mockReturnValue({ upload, remove: jest.fn() });
      let calls = 0;
      const builder = mockScansBuilder(() =>
        Promise.resolve(++calls === 1 ? { error: new Error('db down') } : { error: null })
      );

      await savePendingScan(baseScan('scan_d'));
      FileSystem.deleteAsync.mockClear();

      const first = await flushQueue();
      expect(first.flushed).toBe(0);
      expect(first.failed).toBe(1);
      expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
      expect(JSON.parse(await AsyncStorage.getItem('rootcare_sync_queue'))).toHaveLength(1);

      const second = await flushQueue();
      expect(second.flushed).toBe(1);
      expect(builder.upsert).toHaveBeenCalledTimes(2);
      expect(upload).toHaveBeenCalledTimes(2); // same path, upsert:true -> overwrite, not a 2nd object
      expect(JSON.parse(await AsyncStorage.getItem('rootcare_sync_queue'))).toHaveLength(0);
    });

    test('11. concurrent flushQueue() calls do not double-process', async () => {
      const upload = jest.fn().mockResolvedValue({ error: null });
      supabase.storage.from.mockReturnValue({ upload, remove: jest.fn() });
      mockScansBuilder();

      await savePendingScan(baseScan('scan_e'));
      await Promise.all([flushQueue(), flushQueue(), flushQueue()]);
      expect(upload).toHaveBeenCalledTimes(1);
    });
  });
});
