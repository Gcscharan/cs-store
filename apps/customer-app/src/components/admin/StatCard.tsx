import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import Ionicons from '@expo/vector-icons/Ionicons';

type Props = {
  title: string;
  value: string | number;
  iconName: keyof typeof Ionicons.glyphMap;
  trend?: string;
};

const StatCard: React.FC<Props> = ({ title, value, iconName, trend }) => {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name={iconName} size={20} color={Colors.textSecondary} />
        </View>
        {trend && (
          <View style={styles.trendContainer}>
            <Ionicons name="trending-up" size={12} color="#10b981" />
            <Text style={styles.trendText}>{trend}</Text>
          </View>
        )}
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e0e7ff',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#d1fae5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  trendText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.3,
  },
  value: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
    lineHeight: 36,
    letterSpacing: -1,
  },
  title: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

export default StatCard;
