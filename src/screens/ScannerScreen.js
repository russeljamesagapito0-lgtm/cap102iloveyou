// screens/ScannerScreen.js
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
  Animated,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import NetInfo from '@react-native-community/netinfo';

import { runOfflineInference, loadOfflineModel } from '../utils/offlineInference';
import { enqueueMutation, generateScanId, flushQueue } from '../utils/syncManager';
import { DISEASE_INFO } from '../constants/diseaseInfo';

const { width, height } = Dimensions.get('window');

// ===== API CONFIGURATION =====
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://172.167.134.221:5000';
const API_URL = `${API_BASE_URL}/predict`;
const HEALTH_URL = `${API_BASE_URL}/health`;
const TIMEOUT = parseInt(process.env.EXPO_PUBLIC_API_TIMEOUT || '30000');
const MAX_RETRIES = parseInt(process.env.EXPO_PUBLIC_MAX_RETRIES || '3');
const DEBUG = process.env.EXPO_PUBLIC_DEBUG === 'true';

const COMPUTER_IP = API_BASE_URL.replace('http://', '').replace(':5000', '');

if (DEBUG) {
  console.log('🔧 API Base URL:', API_BASE_URL);
  console.log('🔗 API URL:', API_URL);
  console.log('💚 Health URL:', HEALTH_URL);
}

const fetchWithTimeout = (url, options = {}, timeout = TIMEOUT) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Request timed out')), timeout);
    fetch(url, options)
      .then((response) => {
        clearTimeout(timer);
        resolve(response);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
};

const ScannerScreen = ({ navigation, route }) => {
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isApiReady, setIsApiReady] = useState(false);
  const [apiCheckDone, setApiCheckDone] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Offline state
  const [offlineReady, setOfflineReady] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ===== Init animations + health check + offline model preload =====
  useEffect(() => {
    startScanLineAnimation();
    startPulseAnimation();
    checkApiHealth();

    // Preload offline model (non-blocking)
    loadOfflineModel()
      .then(() => setOfflineReady(true))
      .catch((err) => console.warn('⚠️ Offline model unavailable:', err?.message));

    // Connectivity listener — auto-flush when back online
    let wasConnected = true;
    const unsub = NetInfo.addEventListener((state) => {
      const connected = !!state.isConnected && state.isInternetReachable !== false;
      setIsOnline(connected);

      if (connected && !wasConnected) {
        if (DEBUG) console.log('🌐 Back online — flushing sync queue');
        flushQueue()
          .then((res) => {
            if (res?.flushed > 0 && DEBUG) console.log('✅ Queue flushed:', res);
          })
          .catch((e) => console.warn('Queue flush failed:', e));
      }
      wasConnected = connected;
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      setImage(null);
      setLoading(false);
      setFlashEnabled(false);

      if (route.params?.clearImage) {
        navigation.setParams({ clearImage: undefined });
      }

      const unsubscribe = navigation.addListener('blur', () => {
        setImage(null);
        setLoading(false);
        setFlashEnabled(false);
      });

      return unsubscribe;
    }, [navigation, route.params?.clearImage])
  );

const checkApiHealth = async (attempt = 0) => {
  if (DEBUG) console.log('🔍 Checking API health (attempt ' + (attempt + 1) + '):', HEALTH_URL);
  try {
    const response = await fetchWithTimeout(HEALTH_URL, { method: 'GET' }, 5000); // 5s instead of 30s
    if (response.ok) {
      const data = await response.json();
      if (DEBUG) console.log('✅ Server healthy:', data);
      setIsApiReady(true);
      setApiCheckDone(true);
      setRetryCount(0);
      return true;
    }
    throw new Error('Server error');
  } catch (error) {
    if (DEBUG) console.log('ℹ️ Server unreachable:', error?.message);

    if (attempt < MAX_RETRIES) {
      setRetryCount(attempt + 1);
      setTimeout(() => checkApiHealth(attempt + 1), 2000);
      return false;
    }

    setIsApiReady(false);
    setApiCheckDone(true);

    // Show info toast only ONCE, on final failure
    Toast.show({
      type: 'info',
      text1: '📴 Offline Mode Active',
      text2: 'Server unreachable. Offline scanning is ready.',
      visibilityTime: 3000,
    });

    return false;
  }
};

  const startScanLineAnimation = () => {
    scanLineAnim.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 2500, useNativeDriver: true }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 2500, useNativeDriver: true }),
      ])
    ).start();
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.95, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  };

  // ===== Image → base64 (for online request) =====
  const preprocessImage = async (imageUri) => {
    const manipulatedImage = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 224, height: 224 } }],
      { format: ImageManipulator.SaveFormat.JPEG, compress: 0.9 }
    );
    const response = await fetch(manipulatedImage.uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // ===== Navigate to Result with unified payload =====
  const navigateToResult = (result, imageUri) => {
    navigation.navigate('Result', {
      imageUri,
      diseaseKey: result.diseaseKey || 'UNKNOWN',
      diseaseLabel: result.diseaseName || 'Unknown Disease',
      confidence: result.confidence || 0,
      scanDate: new Date().toISOString(),
      description: result.description || 'No description available.',
      treatment: result.treatment || 'No treatment information available.',
      prevention: result.prevention || 'No prevention information available.',
      severity: result.severity || 'Unknown',
      symptoms: result.symptoms || 'No symptoms listed.',
      allProbabilities: result.allProbabilities || {},
      detectionMetrics: result.detection_metrics || {},
      offline: !!result._offline,
    });
  };

  // ===== Queue offline scan for later sync =====
  const queueOfflineScan = async (imageUri, result) => {
    try {
      const base64Image = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const scanId = generateScanId();
      await enqueueMutation({
        type: 'CREATE_SCAN',
        scanId,
        payload: {
          imageBase64: base64Image,
          cropType: 'cassava',
          capturedAt: new Date().toISOString(),
          diagnosisCode: result.diseaseKey,
          confidence: result.confidence,
          modelVersion: 'resnet50v2-tflite-v1',
          inferredAt: new Date().toISOString(),
        },
      });
      if (DEBUG) console.log('📥 Offline scan queued:', scanId);
    } catch (e) {
      console.warn('Failed to queue offline scan:', e);
    }
  };

  // ===== MAIN: analyze (online → offline fallback) =====
  const analyzeImage = async () => {
    if (!image) {
      Toast.show({
        type: 'error',
        text1: 'No Image',
        text2: 'Please take a photo or upload an image first.',
      });
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // ===== TRY ONLINE FIRST =====
    if (isApiReady && isOnline) {
      try {
        const base64Image = await preprocessImage(image);
        if (DEBUG) console.log('📤 Sending request to:', API_URL);

        const response = await fetchWithTimeout(API_URL, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64Image }),
        });

        if (DEBUG) console.log('📥 Response status:', response.status);

        if (!response.ok) {
          let errMsg = 'Analysis failed';
          try {
            const errorData = await response.json();
            errMsg = errorData.error || errMsg;
          } catch (_) {}
          throw new Error(errMsg);
        }

        const result = await response.json();
        if (DEBUG) console.log('✅ Analysis result:', result);

        if (result.success === false && result.error === 'not_cassava') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          Toast.show({
            type: 'info',
            text1: 'Not a Cassava Leaf',
            text2: result.message || 'Please upload a clear image of a cassava leaf.',
          });
          setLoading(false);
          return;
        }

        if (result.success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          navigateToResult(result, image);
          setLoading(false);
          return;
        }

        throw new Error(result.message || 'Invalid response from server');
      } catch (error) {
        console.warn('⚠️ Online analysis failed, falling back to offline:', error?.message);
        // fall through to offline
      }
    }

    // ===== OFFLINE FALLBACK =====
    if (!offlineReady) {
      setLoading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Toast.show({
        type: 'error',
        text1: 'Offline Unavailable',
        text2: 'Model not loaded yet. Please check your connection and try again.',
        visibilityTime: 4000,
      });
      return;
    }

    try {
      const result = await runOfflineInference(image);

      if (result.success === false && result.error === 'not_cassava') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Toast.show({
          type: 'info',
          text1: 'Not a Cassava Leaf',
          text2: result.message,
          visibilityTime: 4000,
        });
        setLoading(false);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Enrich with local disease info (server normally provides this)
      const info = DISEASE_INFO[result.diseaseKey];
      const enriched = {
        ...result,
        description: info?.description || '',
        treatment: info?.treatment || '',
        prevention: info?.prevention || '',
        severity: info?.severity || 'Unknown',
        symptoms: info?.symptoms || '',
      };

      // Queue for later sync
      await queueOfflineScan(image, result);

      Toast.show({
        type: 'info',
        text1: '📴 Offline Result',
        text2: 'Saved locally — will sync when online.',
        visibilityTime: 3000,
      });

      navigateToResult(enriched, image);
    } catch (error) {
      console.error('❌ Offline inference failed:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Toast.show({
        type: 'error',
        text1: 'Analysis Failed',
        text2: 'Both online and offline analysis failed. Please try again.',
        visibilityTime: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const takePhoto = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
        setImage(photo.uri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (error) {
        console.error('Error taking photo:', error);
      }
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({
        type: 'error',
        text1: 'Permission Denied',
        text2: 'Please grant gallery permissions.',
      });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.9,
    });
    if (!result.canceled) {
      setImage(result.assets[0].uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const removeImage = () => {
    setImage(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Toast.show({
      type: 'success',
      text1: 'Image Removed',
      text2: 'You can take a new photo or upload again.',
      visibilityTime: 1500,
    });
  };

  const scanLineTranslate = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-140, 140],
  });

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-outline" size={60} color="#88D982" />
        <Text style={styles.permissionText}>We need your permission to show the camera</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const canAnalyze = !!image && !loading && (isApiReady || offlineReady);

  // Button label logic
  let analyzeLabel = 'Analyze Leaf';
  if (loading) analyzeLabel = 'Analyzing...';
  else if (!isApiReady && offlineReady) analyzeLabel = 'Analyze Offline';
  else if (!isApiReady && !offlineReady) analyzeLabel = 'Loading...';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.topControlBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Scan Disease</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Status Bar */}
      {apiCheckDone && !isApiReady && (
        <View style={styles.serverErrorBar}>
          <Ionicons name="cloud-offline-outline" size={16} color="#FFFFFF" />
          <Text style={styles.serverErrorText}>
            Offline Mode {offlineReady ? '✅' : '(loading model...)'}
          </Text>
          <TouchableOpacity onPress={() => checkApiHealth(0)} style={styles.retryBtn}>
            <Ionicons name="refresh" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}
      {isApiReady && (
        <View style={styles.serverConnectedBar}>
          <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
          <Text style={styles.serverConnectedText}>Server Connected ✅</Text>
        </View>
      )}

      {/* Main Content */}
      <View style={styles.mainContent}>
        <View style={styles.cameraCard}>
          {image ? (
            <Image source={{ uri: image }} style={styles.previewImage} resizeMode="cover" />
          ) : (
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="back"
              enableTorch={flashEnabled}
            />
          )}

          {image && !loading && (
            <TouchableOpacity style={styles.removeButton} onPress={removeImage} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          <View style={styles.scanFrameContainer}>
            <View style={styles.scanFrame}>
              <View style={styles.cornerTL} />
              <View style={styles.cornerTR} />
              <View style={styles.cornerBL} />
              <View style={styles.cornerBR} />
              <Animated.View
                style={[styles.scanLine, { transform: [{ translateY: scanLineTranslate }] }]}
              />
              <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />
            </View>
          </View>
        </View>

        {loading && (
          <View style={styles.statusContainer}>
            <View style={styles.statusHeader}>
              <ActivityIndicator size="small" color="#88D982" />
              <Text style={styles.statusLabel}>Analyzing...</Text>
            </View>
          </View>
        )}

        <View style={styles.controlsContainer}>
          <TouchableOpacity style={styles.galleryButton} onPress={pickImage} activeOpacity={0.7}>
            <Ionicons name="images-outline" size={26} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shutterButton}
            onPress={takePhoto}
            activeOpacity={0.8}
            disabled={loading}
          >
            <View style={styles.shutterInner} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.flashButton}
            onPress={() => setFlashEnabled(!flashEnabled)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={flashEnabled ? 'flash' : 'flash-outline'}
              size={26}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>

        {image && !loading && (
          <TouchableOpacity
            style={[styles.analyzeButton, !canAnalyze && styles.analyzeButtonDisabled]}
            onPress={analyzeImage}
            activeOpacity={0.85}
            disabled={!canAnalyze}
          >
            <Ionicons name="scan-outline" size={20} color="#FFFFFF" />
            <Text style={styles.analyzeButtonText}>{analyzeLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 20,
  },
  permissionButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 16 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0A0A0A',
    zIndex: 10,
  },
  topControlBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  topTitle: { fontSize: 18, fontWeight: '600', color: '#FFFFFF' },

  serverErrorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 0, 0, 0.85)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 8,
    marginHorizontal: 20,
    borderRadius: 8,
    marginTop: 4,
  },
  serverConnectedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(46, 125, 50, 0.95)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 8,
    marginHorizontal: 20,
    borderRadius: 8,
    marginTop: 4,
  },
  serverErrorText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  serverConnectedText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  retryBtn: { padding: 4 },

  mainContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  cameraCard: {
    width: width - 40,
    height: height * 0.55,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(136, 217, 130, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    position: 'relative',
  },
  camera: { width: '100%', height: '100%' },
  previewImage: { width: '100%', height: '100%' },

  removeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },

  scanFrameContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 220,
    height: 220,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(136, 217, 130, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  cornerTL: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 32,
    height: 32,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#88D982',
    borderTopLeftRadius: 12,
  },
  cornerTR: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 32,
    height: 32,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#88D982',
    borderTopRightRadius: 12,
  },
  cornerBL: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 32,
    height: 32,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#88D982',
    borderBottomLeftRadius: 12,
  },
  cornerBR: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 32,
    height: 32,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#88D982',
    borderBottomRightRadius: 12,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#88D982',
    shadowColor: '#88D982',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 8,
  },
  pulseRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(136, 217, 130, 0.1)',
    borderRadius: 16,
  },

  statusContainer: { position: 'absolute', top: '50%', marginTop: 20 },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    width: '100%',
    marginTop: 30,
  },
  galleryButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
  },
  flashButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
  },
  shutterButton: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  shutterInner: { width: '100%', height: '100%', borderRadius: 35, backgroundColor: '#FFFFFF' },

  analyzeButton: {
    marginTop: 20,
    width: '100%',
    maxWidth: width - 40,
    backgroundColor: '#2E7D32',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  analyzeButtonDisabled: { backgroundColor: '#666666', opacity: 0.7 },
  analyzeButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});

export default ScannerScreen;