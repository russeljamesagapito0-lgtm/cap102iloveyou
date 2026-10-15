import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Modal } from 'react-native';

const LoadingOverlay = ({ visible, message = 'Processing...' }) => {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#C77A58" />
          <Text style={styles.message}>{message}</Text>
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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    gap: 16,
  },
  message: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
});

export default LoadingOverlay;