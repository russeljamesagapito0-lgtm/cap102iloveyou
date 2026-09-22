// screens/OnboardingScreen.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, Dimensions,
  StatusBar, Image, Animated, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const { width, height } = Dimensions.get('window');

const OnboardingScreen = ({ navigation }) => {
  const { themeColors, isDarkMode } = useTheme();
  const [showSplash, setShowSplash] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const loadingProgress = useRef(new Animated.Value(0)).current;
  const splashFade = useRef(new Animated.Value(1)).current;

  const slides = [
    { id: '1', subtitle: 'Rooted in Nature, Powered by Technology', image: require('../assets/logo.png'), description: 'Your AI-powered cassava disease detection assistant', icon: 'leaf-outline' },
    { id: '2', title: 'Protect Your Harvest', subtitle: 'Instantly detect cassava diseases with our AI-powered scanner.', image: require('../assets/SecondSlide.png'), description: 'Get expert treatment advice in seconds', icon: 'scan-outline' },
    { id: '3', title: 'Smart Farming', subtitle: 'Monitor crop health and get real-time insights.', image: require('../assets/ThirdSlide.png'), description: 'Make informed decisions with data-driven analysis', icon: 'stats-chart-outline' },
    { id: '4', title: 'Grow Your Income', subtitle: 'Connect with farmers, negotiate fair prices, and earn more.', image: require('../assets/LastSlide.png'), description: 'Buy and sell root crops directly through the marketplace', icon: 'storefront-outline' },
  ];

  useEffect(() => {
    Animated.timing(loadingProgress, { toValue: 100, duration: 2500, useNativeDriver: false }).start(() => {
      Animated.timing(splashFade, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => setShowSplash(false));
    });
  }, []);

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
      setCurrentIndex(currentIndex + 1);
    } else navigation.replace('Login');
  };

  const handleSkip = () => navigation.replace('Login');

  const renderItem = ({ item, index }) => {
    const isLast = index === slides.length - 1;
    const isFirstSlide = index === 0;
    const isSecondSlide = index === 1;
    const showWhitePlate = !isFirstSlide;

    return (
      <View style={[styles.slide, { backgroundColor: themeColors.background }]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

        <View style={styles.topNavigation}>
          {isFirstSlide && (
            <TouchableOpacity style={styles.skipButton} onPress={handleSkip} activeOpacity={0.7}>
              <Text style={[styles.skipButtonText, { color: themeColors.textSecondary }]}>Skip</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.contentWrapper}>
          <View style={styles.imageContainer}>
            <View style={showWhitePlate ? [styles.imageWrapper, { backgroundColor: themeColors.card, borderColor: themeColors.border }] : styles.imageWrapperPlain}>
              <Image source={item.image} style={styles.mainImage} resizeMode={showWhitePlate ? 'cover' : 'contain'} />

              {isSecondSlide && (
                <>
                  <View style={styles.scannerOverlay}>
                    <View style={[styles.scannerCornerTL, { borderColor: themeColors.primary }]} />
                    <View style={[styles.scannerCornerTR, { borderColor: themeColors.primary }]} />
                    <View style={[styles.scannerCornerBL, { borderColor: themeColors.primary }]} />
                    <View style={[styles.scannerCornerBR, { borderColor: themeColors.primary }]} />
                    <View style={[styles.scanningLine, { backgroundColor: themeColors.primary }]} />
                  </View>
                  <View style={[styles.aiTag, { backgroundColor: themeColors.primary }]}>
                    <Ionicons name="bulb-outline" size={14} color={themeColors['on-primary']} />
                    <Text style={[styles.aiTagText, { color: themeColors['on-primary'] }]}>AI Detection</Text>
                  </View>
                </>
              )}
            </View>
          </View>

          <View style={styles.contentContainer}>
            {isFirstSlide ? (
              <>
                <Text style={[styles.titleFirst, { color: themeColors.primary }]}>{item.subtitle}</Text>
                <Text style={[styles.subtitleFirst, { color: themeColors.textSecondary }]}>{item.description}</Text>
              </>
            ) : (
              <>
                <Text style={[styles.title, { color: themeColors.text }]}>{item.title}</Text>
                <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>{item.subtitle}</Text>
                {item.description && <Text style={[styles.description, { color: themeColors.textSecondary }]}>{item.description}</Text>}
              </>
            )}
          </View>
        </View>

        <View style={styles.navigationContainer}>
          <View style={styles.dotsContainer}>
            {slides.map((_, i) => {
              const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
              const dotWidth = scrollX.interpolate({ inputRange, outputRange: [8, 32, 8], extrapolate: 'clamp' });
              const dotOpacity = scrollX.interpolate({ inputRange, outputRange: [0.4, 1, 0.4], extrapolate: 'clamp' });
              return <Animated.View key={i} style={[styles.dot, { backgroundColor: themeColors.primary, width: dotWidth, opacity: dotOpacity }]} />;
            })}
          </View>

          <View style={styles.bottomNavigation}>
            <TouchableOpacity style={[styles.nextButton, { backgroundColor: themeColors.primary }]} onPress={handleNext} activeOpacity={0.85}>
              <Text style={[styles.nextButtonText, { color: themeColors['on-primary'] }]}>{isLast ? 'Get Started' : 'Next'}</Text>
              {!isLast && <Ionicons name="arrow-forward" size={20} color={themeColors['on-primary']} />}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderSplash = () => {
    const loadingWidth = loadingProgress.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
    return (
      <Animated.View style={[styles.splashContainer, { backgroundColor: themeColors.background, opacity: splashFade }]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <View style={styles.splashContent}>
          <View style={styles.splashLogoWrapper}>
            <Image source={require('../assets/emblem.png')} style={styles.splashLogo} resizeMode="contain" />
          </View>
          <View style={styles.splashTextContainer}>
            <Text style={[styles.splashTitle, { color: themeColors.primary }]}>RootCare</Text>
            <Text style={[styles.splashSubtitle, { color: themeColors.textSecondary }]}>
              Rooted in Nature, <Text style={[styles.splashSubtitleAccent, { color: themeColors.primary }]}>Powered by Technology</Text>
            </Text>
          </View>
          <View style={styles.splashLoadingContainer}>
            <View style={[styles.splashLoadingBarTrack, { backgroundColor: themeColors.border }]}>
              <Animated.View style={[styles.splashLoadingBarFill, { backgroundColor: themeColors.primary, width: loadingWidth }]} />
            </View>
            <View style={styles.splashLoadingLabel}>
              <Text style={[styles.splashLoadingText, { color: themeColors.textSecondary }]}>Initializing Field Data</Text>
            </View>
          </View>
        </View>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      {showSplash ? renderSplash() : (
        <FlatList
          ref={flatListRef}
          data={slides}
          renderItem={renderItem}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
          onMomentumScrollEnd={(e) => setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          scrollEnabled={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  splashContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  splashContent: { alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  splashLogoWrapper: { marginBottom: 16 },
  splashLogo: { width: 350, height: 350 },
  splashTextContainer: { alignItems: 'center', marginBottom: 32 },
  splashTitle: { fontSize: 40, fontWeight: '700', marginBottom: 8, letterSpacing: -0.5 },
  splashSubtitle: { fontSize: 14, fontWeight: '400', textAlign: 'center' },
  splashSubtitleAccent: { fontWeight: '600' },
  splashLoadingContainer: { width: '80%', maxWidth: 300, alignItems: 'center' },
  splashLoadingBarTrack: { width: '100%', height: 4, borderRadius: 2, overflow: 'hidden', marginBottom: 12 },
  splashLoadingBarFill: { height: '100%', borderRadius: 2 },
  splashLoadingLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  splashLoadingText: { fontSize: 10, fontWeight: '500', letterSpacing: 2, textTransform: 'uppercase' },
  slide: { width, height, paddingHorizontal: 20, paddingBottom: 20 },
  topNavigation: { position: 'absolute', top: 85, right: 35, zIndex: 10 },
  skipButton: { paddingVertical: 6, paddingHorizontal: 10 },
  skipButtonText: { fontSize: 14, fontWeight: '500', letterSpacing: 0.3 },
  contentWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  imageContainer: { alignItems: 'center', justifyContent: 'center', position: 'relative', marginBottom: 16, marginTop: 40 },
  imageWrapper: { width: '100%', maxWidth: 280, aspectRatio: 1, borderRadius: 16, overflow: 'hidden', borderWidth: 1, position: 'relative' },
  imageWrapperPlain: { width: '100%', maxWidth: 280, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  mainImage: { width: '100%', height: '100%' },
  scannerOverlay: { position: 'absolute', top: 16, left: 16, right: 16, bottom: 16, borderWidth: 2, borderColor: 'rgba(136, 217, 130, 0.5)', borderRadius: 8 },
  scannerCornerTL: { position: 'absolute', top: -2, left: -2, width: 20, height: 20, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 4 },
  scannerCornerTR: { position: 'absolute', top: -2, right: -2, width: 20, height: 20, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 4 },
  scannerCornerBL: { position: 'absolute', bottom: -2, left: -2, width: 20, height: 20, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 4 },
  scannerCornerBR: { position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 4 },
  scanningLine: { position: 'absolute', left: 0, right: 0, height: 2, opacity: 0.8, top: '50%' },
  aiTag: { position: 'absolute', top: 20, right: 20, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 4 },
  aiTagText: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  contentContainer: { alignItems: 'center', paddingHorizontal: 16, paddingVertical: 4 },
  titleFirst: { fontSize: 32, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  subtitleFirst: { fontSize: 15, fontWeight: '400', textAlign: 'center', lineHeight: 22, marginBottom: 4 },
  descriptionFirst: { fontSize: 14, fontWeight: '400', textAlign: 'center' },
  title: { fontSize: 26, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 15, fontWeight: '400', textAlign: 'center', lineHeight: 22 },
  description: { fontSize: 14, fontWeight: '400', textAlign: 'center', marginTop: 4 },
  navigationContainer: { alignItems: 'center', gap: 12, paddingBottom: 10, width: '100%' },
  dotsContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  dot: { height: 8, borderRadius: 4 },
  bottomNavigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 12 },
  nextButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12, flex: 1, gap: 8 },
  nextButtonText: { fontSize: 15, fontWeight: '600', letterSpacing: 0.5 },
});

export default OnboardingScreen;