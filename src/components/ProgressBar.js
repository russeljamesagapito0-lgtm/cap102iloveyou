import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const ProgressBar = ({ progress, total, label }) => {
  const percentage = (progress / total) * 100;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.percentage}>{Math.round(percentage)}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percentage}%` }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 12,
    color: '#5C3D2E',
  },
  percentage: {
    fontSize: 12,
    color: '#C77A58',
    fontWeight: '600',
  },
  track: {
    height: 8,
    backgroundColor: '#E4D3BB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#C77A58',
    borderRadius: 4,
  },
});

export default ProgressBar;