// screens/ChatbotScreen.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Dimensions,
  Alert,
  Image,
  Animated,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');
const SIDEBAR_WIDTH = Math.min(340, width * 0.85);

const findTabNavigator = (navigation) => {
  if (navigation.getState()?.type === 'tab') return navigation;
  let nav = navigation.getParent();
  while (nav && nav.getState()?.type !== 'tab') nav = nav.getParent();
  return nav;
};

const ChatbotScreen = ({ navigation }) => {
  const { themeColors, isDarkMode } = useTheme();

  const [messages, setMessages] = useState([
    { id: '1', text: 'Hello! How can I help you with your root crop farming today?', sender: 'bot' },
  ]);
  const [inputText, setInputText] = useState('');
  const [suggestedTopics] = useState([
    { id: '1', text: 'What are the best root crop varieties to plant?', icon: 'leaf-outline' },
    { id: '2', text: 'How do I treat common root crop diseases?', icon: 'medical-outline' },
    { id: '3', text: 'When is the right time to harvest root crops?', icon: 'calendar-outline' },
    { id: '4', text: 'What type of fertilizer is best for root crops?', icon: 'flower-outline' },
  ]);
  const [conversationHistory] = useState([
    { id: '1', title: 'Cassava Mosaic Disease', date: 'Today, 2:30 PM', preview: 'How to identify and treat mosaic disease' },
    { id: '2', title: 'Brown Spot Disease', date: 'Yesterday, 11:15 AM', preview: 'Treatment for brown spot disease' },
    { id: '3', title: 'Harvesting Tips', date: 'Jan 12, 2024', preview: 'Best practices for harvesting root crops' },
    { id: '4', title: 'Fertilizer Guide', date: 'Jan 10, 2024', preview: 'Optimal fertilizer application for root crops' },
    { id: '5', title: 'Root Crop Pest Control', date: 'Jan 8, 2024', preview: 'Managing root crop pests naturally' },
    { id: '6', title: 'Soil Preparation', date: 'Jan 5, 2024', preview: 'How to prepare soil for root crop planting' },
  ]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const inputRef = useRef(null);
  const flatListRef = useRef(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useFocusEffect(
    React.useCallback(() => {
      const tabNavigator = findTabNavigator(navigation);
      if (tabNavigator) tabNavigator.setOptions({ tabBarStyle: { display: 'none' } });
      return () => {
        const tn = findTabNavigator(navigation);
        if (tn) tn.setOptions({ tabBarStyle: { display: 'flex' } });
      };
    }, [navigation])
  );

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const openHistory = () => {
    setShowHistory(true);
    Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start();
  };

  const closeHistory = () => {
    Animated.timing(slideAnim, { toValue: -SIDEBAR_WIDTH, duration: 240, useNativeDriver: true }).start(() => setShowHistory(false));
  };

  const sendMessage = (text) => {
    if (!text || !text.trim()) return;
    const userMessage = { id: Date.now().toString(), text: text.trim(), sender: 'user' };
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setShowSuggestions(false);
    Keyboard.dismiss();
    setTimeout(() => {
      const botResponse = {
        id: (Date.now() + 1).toString(),
        text: getBotResponse(text),
        sender: 'bot',
      };
      setMessages((prev) => [...prev, botResponse]);
    }, 1000);
  };

  const getBotResponse = (userInput) => {
    const lowerInput = userInput.toLowerCase();
    if (lowerInput.includes('mosaic')) return 'Cassava Mosaic Disease is caused by a virus spread by whiteflies. Remove infected plants immediately, plant resistant varieties, and control whitefly populations. Always use disease-free planting materials.';
    if (lowerInput.includes('brown') || lowerInput.includes('spot')) return 'Brown Spot Disease is caused by the fungus Cercospora henningsii. Apply copper-based fungicides, ensure proper drainage, practice crop rotation, and remove infected leaves.';
    if (lowerInput.includes('harvest')) return 'Most root crops are harvested 8-12 months after planting depending on the variety. Harvest when leaves start to yellow and fall off, and the stems become woody.';
    if (lowerInput.includes('fertilizer') || lowerInput.includes('fertilize')) return 'Root crops respond well to balanced fertilization. Apply 60-90 kg N/ha, 20-30 kg P/ha, and 60-90 kg K/ha. Use organic compost or manure for better soil structure.';
    if (lowerInput.includes('soil') || lowerInput.includes('prepare')) return 'Root crops grow best in well-drained, sandy loam soils with pH 5.5-6.5. Prepare soil by deep plowing (25-30 cm), remove weeds, and incorporate organic matter.';
    if (lowerInput.includes('pest') || lowerInput.includes('insect')) return 'Common root crop pests include mealybugs, whiteflies, and green mites. Control through biological methods, resistant varieties, and proper field sanitation.';
    if (lowerInput.includes('variety') || lowerInput.includes('plant')) return 'There are many root crop varieties to choose from - cassava, sweet potato, taro, and yam among them. Choose based on your purpose and soil conditions.';
    return 'I understand your question about root crop farming. For specific advice, I recommend consulting with your local agricultural extension officer.';
  };

  const handleTopicPress = (topic) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendMessage(topic.text);
  };

  const handleNewChat = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMessages([{ id: '1', text: 'Hello! How can I help you with your root crop farming today?', sender: 'bot' }]);
    setShowSuggestions(true);
    Keyboard.dismiss();
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant gallery permissions to upload images of your root crops for diagnosis.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled) {
      setAttachments([...attachments, { id: Date.now().toString(), uri: result.assets[0].uri, type: 'image' }]);
      setShowAttachmentMenu(false);
      Alert.alert('OK Uploaded', 'Crop image attached successfully!');
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera permissions.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 1 });
    if (!result.canceled) {
      setAttachments([...attachments, { id: Date.now().toString(), uri: result.assets[0].uri, type: 'image' }]);
      setShowAttachmentMenu(false);
      Alert.alert('OK Captured', 'Crop photo captured successfully!');
    }
  };

  const removeAttachment = (id) => setAttachments(attachments.filter(att => att.id !== id));

  const renderMessage = ({ item }) => (
    <View
      style={[
        styles.messageContainer,
        item.sender === 'user'
          ? [styles.userMessage, { backgroundColor: themeColors.primary }]
          : [styles.botMessage, { backgroundColor: themeColors.surface }],
      ]}
    >
      <Text
        style={[
          styles.messageText,
          item.sender === 'user'
            ? [styles.userText, { color: themeColors['on-primary'] }]
            : [styles.botText, { color: themeColors.text }],
        ]}
      >
        {item.text}
      </Text>
    </View>
  );

  const renderSuggestedTopic = ({ item }) => (
    <TouchableOpacity
      style={[styles.topicItem, { backgroundColor: themeColors.card }]}
      onPress={() => handleTopicPress(item)}
      activeOpacity={0.7}
    >
      <Ionicons name={item.icon} size={20} color={themeColors.text} />
      <Text style={[styles.topicText, { color: themeColors.text }]}>{item.text}</Text>
      <Ionicons name="chevron-forward" size={16} color={themeColors.textSecondary} />
    </TouchableOpacity>
  );

  const renderHistoryItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.historyItem, { borderBottomColor: themeColors.border }]}
      onPress={() => closeHistory()}
      activeOpacity={0.7}
    >
      <View style={styles.historyItemContent}>
        <Text style={[styles.historyItemTitle, { color: themeColors.text }]}>{item.title}</Text>
        <Text style={[styles.historyItemPreview, { color: themeColors.textSecondary }]} numberOfLines={1}>{item.preview}</Text>
        <Text style={[styles.historyItemDate, { color: themeColors.textSecondary }]}>{item.date}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
    </TouchableOpacity>
  );

  const renderAttachment = ({ item }) => (
    <View style={styles.attachmentItem}>
      <Image source={{ uri: item.uri }} style={styles.attachmentImage} />
      <TouchableOpacity style={[styles.attachmentRemove, { backgroundColor: themeColors.card }]} onPress={() => removeAttachment(item.id)}>
        <Ionicons name="close-circle" size={20} color={themeColors.error} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: themeColors.background, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('Home')} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={themeColors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerText, { color: themeColors.primary }]}>RootCare Companion</Text>
        <View style={styles.headerRightActions}>
          <TouchableOpacity style={styles.menuButton} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); openHistory(); }}>
            <Ionicons name="menu-outline" size={22} color={themeColors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.newChatButton} onPress={handleNewChat}>
            <Ionicons name="create-outline" size={22} color={themeColors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.chatArea}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListHeaderComponent={
            showSuggestions && messages.length === 1 ? (
              <View style={[styles.suggestionsContainer, { backgroundColor: themeColors.surface }]}>
                <Text style={[styles.suggestionsHeader, { color: themeColors.text }]}>Frequently Asked Questions</Text>
                <FlatList
                  data={suggestedTopics}
                  renderItem={renderSuggestedTopic}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  contentContainerStyle={styles.suggestionsList}
                />
              </View>
            ) : null
          }
        />

        {attachments.length > 0 && (
          <View style={styles.attachmentsContainer}>
            <FlatList
              data={attachments}
              renderItem={renderAttachment}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.attachmentsList}
            />
          </View>
        )}

        <View style={[styles.inputContainer, {
          backgroundColor: themeColors.background,
          borderTopColor: themeColors.border,
          marginBottom: keyboardHeight > 0 ? keyboardHeight : 16,
        }]}>
          <TouchableOpacity style={styles.attachButton} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowAttachmentMenu(!showAttachmentMenu); }}>
            <Ionicons name="attach-outline" size={24} color={themeColors.textSecondary} />
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            style={[styles.input, {
              color: themeColors.text,
              backgroundColor: themeColors.card,
              borderColor: isInputFocused ? themeColors.primary : themeColors.border,
              borderWidth: isInputFocused ? 2 : 1,
            }]}
            placeholder="Ask about root crop farming..."
            placeholderTextColor={themeColors.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            multiline
            returnKeyType="send"
            onSubmitEditing={() => sendMessage(inputText)}
          />

          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: themeColors.primary }, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={() => sendMessage(inputText)}
            activeOpacity={0.85}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={18} color={themeColors['on-primary']} />
          </TouchableOpacity>
        </View>

        <Modal visible={showAttachmentMenu} transparent animationType="fade" onRequestClose={() => setShowAttachmentMenu(false)}>
          <TouchableOpacity style={styles.attachmentMenuOverlay} activeOpacity={1} onPress={() => setShowAttachmentMenu(false)}>
            <View style={[styles.attachmentMenu, { backgroundColor: themeColors.card }]}>
              <TouchableOpacity style={[styles.attachmentMenuItem, { borderBottomColor: themeColors.border }]} onPress={takePhoto}>
                <Ionicons name="camera-outline" size={24} color={themeColors.text} />
                <Text style={[styles.attachmentMenuText, { color: themeColors.text }]}>Take Photo of Crop</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.attachmentMenuItem, { borderBottomColor: themeColors.border }]} onPress={pickImage}>
                <Ionicons name="images-outline" size={24} color={themeColors.text} />
                <Text style={[styles.attachmentMenuText, { color: themeColors.text }]}>Upload Crop Image</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachmentMenuItem} onPress={() => setShowAttachmentMenu(false)}>
                <Ionicons name="close-circle-outline" size={24} color={themeColors.error} />
                <Text style={[styles.attachmentMenuText, { color: themeColors.error }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>

      {showHistory && (
        <View style={styles.historyOverlayContainer}>
          <TouchableOpacity style={styles.historyBackdrop} activeOpacity={1} onPress={closeHistory} />
          <Animated.View style={[styles.historySidebar, { backgroundColor: themeColors.card, transform: [{ translateX: slideAnim }] }]}>
            <View style={[styles.historyHeader, { borderBottomColor: themeColors.border }]}>
              <Text style={[styles.historyTitle, { color: themeColors.text }]}>RootCare Chats</Text>
              <TouchableOpacity onPress={closeHistory}>
                <Ionicons name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={conversationHistory}
              renderItem={renderHistoryItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.historyList}
              ListEmptyComponent={
                <View style={styles.historyEmpty}>
                  <Ionicons name="leaf-outline" size={48} color={themeColors.primary} />
                  <Text style={[styles.historyEmptyText, { color: themeColors.textSecondary }]}>No conversations yet</Text>
                </View>
              }
            />
            <TouchableOpacity style={[styles.historyNewChat, { backgroundColor: themeColors.primary }]} onPress={() => { closeHistory(); handleNewChat(); }}>
              <Ionicons name="add-circle-outline" size={24} color={themeColors['on-primary']} />
              <Text style={[styles.historyNewChatText, { color: themeColors['on-primary'] }]}>New Chat</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}
    </SafeAreaView>
  );
};

const HEADER_HEIGHT = 52;

const styles = StyleSheet.create({
  container: { flex: 1, ...(Platform.OS === 'web' ? { height: '100vh', overflow: 'hidden' } : {}) },
  header: { width: '100%', minHeight: HEADER_HEIGHT, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1 },
  backButton: { padding: 4 },
  menuButton: { padding: 4 },
  headerRightActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerText: { fontSize: 18, fontWeight: '600' },
  newChatButton: { padding: 4 },
  chatArea: { flex: 1 },
  messagesList: { padding: 16, paddingBottom: 20, flexGrow: 1 },
  messageContainer: { maxWidth: '80%', padding: 12, borderRadius: 16, marginBottom: 10 },
  userMessage: { alignSelf: 'flex-end' },
  botMessage: { alignSelf: 'flex-start' },
  messageText: { fontSize: 14, lineHeight: 20 },
  userText: {},
  botText: {},
  suggestionsContainer: { borderRadius: 16, padding: 16, marginBottom: 16 },
  suggestionsHeader: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  suggestionsList: { gap: 4 },
  topicItem: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 6, gap: 10 },
  topicText: { flex: 1, fontSize: 14 },
  attachmentsContainer: { paddingHorizontal: 12, paddingBottom: 8 },
  attachmentsList: { gap: 8 },
  attachmentItem: { position: 'relative', marginRight: 8 },
  attachmentImage: { width: 60, height: 60, borderRadius: 8 },
  attachmentRemove: { position: 'absolute', top: -6, right: -6, borderRadius: 10 },
  inputContainer: { flexDirection: 'row', padding: 12, paddingBottom: 20, borderTopWidth: 1, alignItems: 'flex-end', gap: 8 },
  attachButton: { paddingVertical: 8, paddingHorizontal: 4, justifyContent: 'center' },
  input: { flex: 1, minHeight: 44, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14, maxHeight: 140, fontSize: 15, lineHeight: 20 },
  sendButton: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  sendButtonDisabled: { opacity: 0.5 },
  attachmentMenuOverlay: { flex: 1, backgroundColor: 'rgba(44, 22, 14, 0.5)', justifyContent: 'flex-end' },
  attachmentMenu: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  attachmentMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 14, borderBottomWidth: 1 },
  attachmentMenuText: { fontSize: 16 },
  historyOverlayContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', zIndex: 100 },
  historyBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(44, 22, 14, 0.5)' },
  historySidebar: { width: SIDEBAR_WIDTH, height: '100%', borderTopRightRadius: 24, borderBottomRightRadius: 24 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 48, borderBottomWidth: 1 },
  historyTitle: { fontSize: 20, fontWeight: '700' },
  historyList: { padding: 16, paddingBottom: 80 },
  historyItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1 },
  historyItemContent: { flex: 1, gap: 2 },
  historyItemTitle: { fontSize: 15, fontWeight: '600' },
  historyItemPreview: { fontSize: 13 },
  historyItemDate: { fontSize: 11 },
  historyNewChat: { position: 'absolute', bottom: 30, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 999, gap: 8 },
  historyNewChatText: { fontSize: 16, fontWeight: '600' },
  historyEmpty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  historyEmptyText: { fontSize: 16 },
});

export default ChatbotScreen;