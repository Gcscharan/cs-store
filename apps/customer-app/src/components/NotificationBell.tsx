/**
 * NotificationBell — Reusable notification bell icon with real-time unread badge.
 *
 * Uses:
 * - useGetUnreadCountQuery() from RTK Query for initial + server-backed count
 * - Socket.IO `notification:unread_count` event for real-time badge updates
 *
 * The badge hides when count = 0 and displays "9+" when count exceeds 9.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useGetUnreadCountQuery } from '../api/notificationsApi';
import { socketClient } from '../services/socketClient';
import { Colors } from '../constants/colors';

interface NotificationBellProps {
  /** Override default navigation target */
  onPress?: () => void;
  /** Icon size (default: 22) */
  size?: number;
  /** Icon color (default: Colors.white) */
  color?: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  onPress,
  size = 22,
  color = Colors.white,
}) => {
  const navigation = useNavigation<any>();

  // Fetch initial unread count from server via RTK Query
  const { data } = useGetUnreadCountQuery(undefined, {
    pollingInterval: undefined, // No polling — we rely on socket events
  });

  // Local state for real-time socket-driven updates
  const [realtimeCount, setRealtimeCount] = useState<number | null>(null);

  // The displayed count: prefer real-time socket value, fall back to server query
  const unreadCount = realtimeCount !== null ? realtimeCount : (data?.count ?? 0);

  useEffect(() => {
    // When RTK Query data refreshes (e.g. after markAsRead tag invalidation),
    // reset the realtime override so we use fresh server data
    if (data?.count !== undefined) {
      setRealtimeCount(null);
    }
  }, [data?.count]);

  useEffect(() => {
    // Listen for real-time unread count updates via socketClient's public API
    const unsubscribe = socketClient.subscribeToUnreadCount((payload) => {
      setRealtimeCount(payload.count);
    });

    return unsubscribe;
  }, []);

  const handlePress = useCallback(() => {
    if (onPress) {
      onPress();
    } else {
      navigation.navigate('Notifications');
    }
  }, [onPress, navigation]);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityLabel={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      accessibilityRole="button"
    >
      <Ionicons name="notifications-outline" size={size} color={color} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: Colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
});

export default NotificationBell;
