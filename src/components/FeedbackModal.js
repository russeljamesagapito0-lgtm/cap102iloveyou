import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from './Button';

const FeedbackModal = ({ visible, onClose, onSubmit }) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [feedbackType, setFeedbackType] = useState('');

  const handleSubmit = () => {
    if (rating === 0) {
      Toast.show({ type: 'error', text1: 'Please select a rating' });
      return;
    }
    onSubmit({ rating, comment, feedbackType });
    onClose();
    Toast.show({ type: 'success', text1: 'Thank you for your feedback!' });
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Send Feedback</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Rating Stars */}
          <View style={styles.ratingContainer}>
            <Text style={styles.label}>How was your experience?</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  style={styles.starButton}
                >
                  <Ionicons
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={32}
                    color={star <= rating ? '#FFD700' : '#CCC'}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Feedback Type */}
          <View style={styles.typeContainer}>
            <Text style={styles.label}>Feedback Type</Text>
            <View style={styles.typeButtons}>
              {['Bug', 'Suggestion', 'Question', 'Praise'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeButton,
                    feedbackType === type && styles.typeButtonActive,
                  ]}
                  onPress={() => setFeedbackType(type)}
                >
                  <Text
                    style={[
                      styles.typeText,
                      feedbackType === type && styles.typeTextActive,
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Comment */}
          <View style={styles.commentContainer}>
            <Text style={styles.label}>Additional Comments</Text>
            <TextInput
              style={styles.input}
              placeholder="Tell us more..."
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={4}
            />
          </View>

          <Button
            title="Submit Feedback"
            onPress={handleSubmit}
            style={styles.submitButton}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#F5EDE3',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#5C3D2E',
  },
  ratingContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5C3D2E',
    marginBottom: 8,
  },
  stars: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  typeContainer: {
    marginBottom: 20,
  },
  typeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#E4D3BB',
  },
  typeButtonActive: {
    backgroundColor: '#C77A58',
  },
  typeText: {
    color: '#5C3D2E',
    fontWeight: '500',
  },
  typeTextActive: {
    color: '#FFFFFF',
  },
  commentContainer: {
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E4D3BB',
  },
  submitButton: {
    width: '100%',
  },
});

export default FeedbackModal;