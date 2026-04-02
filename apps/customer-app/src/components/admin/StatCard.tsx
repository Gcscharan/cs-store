import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';

type Props = {
  title: string;
  value: string | number;
  icon: string;
  color?: string;
};

const StatCard: React.FC<Props> = ({ title, value, icon, color }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.title}>{title}</Text>
      <View style={[styles.accent, { backgroundColor: color ?? Colors.primary }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 92,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  icon: {
    position: 'absolute',
    top: 10,
    right: 10,
    fontSize: 18,
  },
  value: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.primary,
    marginTop: 8,
  },
  title: {
    marginTop: 6,
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  accent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
  },
});

export default StatCard;
