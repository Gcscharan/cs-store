import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch, ActivityIndicator,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { ErrorState } from '../../components/common/ErrorState';
import { logEvent } from '../../utils/analytics';
import {
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
  NotificationPreferences,
} from '../../api/settingsApi';
import { showToast } from '../../store/slices/uiSlice';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../store';

// --- Per-Channel Toggles ---
const CHANNELS = [
  { id: 'push', label: '🔔 Push Notifications', description: 'Receive alerts even when the app is closed' },
  { id: 'inapp', label: '📱 In-App', description: 'See notifications inside the app notification center' },
  { id: 'socket', label: '⚡ Real-Time (Socket)', description: 'Instant updates while you are using the app' },
];

// --- Per-Category Toggles ---
const CATEGORIES = [
  {
    id: 'orders',
    title: '📦 Orders',
    description: 'Order confirmations, packing updates, and delivery status changes',
  },
  {
    id: 'delivery',
    title: '🚚 Delivery',
    description: 'Delivery partner assignments, pickup progress, and live tracking alerts',
  },
  {
    id: 'payments',
    title: '💳 Payments',
    description: 'Payment confirmations, refund status, and transaction failure alerts',
  },
  {
    id: 'account',
    title: '👤 Account',
    description: 'Security alerts, login activity, profile changes, and password updates',
  },
  {
    id: 'promotions',
    title: '🎁 Promotions',
    description: 'Special offers, discount coupons, seasonal deals, and new arrivals',
  },
];

// Default preferences reflecting all channels and categories enabled
const DEFAULT_PREFS: NotificationPreferences = {
  push: { enabled: true, categories: { orders: true, delivery: true, payments: true, account: true, promotions: true } },
  inapp: { enabled: true, categories: { orders: true, delivery: true, payments: true, account: true, promotions: true } },
  socket: { enabled: true, categories: { orders: true, delivery: true, payments: true, account: true, promotions: true } },
};

export default function NotificationPreferencesScreen({ navigation }: any) {
  const dispatch = useDispatch<AppDispatch>();
  const [settings, setSettings] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [savingItems, setSavingItems] = useState<Set<string>>(new Set());

  const { data: prefsData, isLoading, error, refetch } = useGetNotificationPreferencesQuery();
  const [updatePrefs] = useUpdateNotificationPreferencesMutation();

  useEffect(() => {
    logEvent('screen_view', { screen: 'NotificationPreferences' });
  }, []);

  // Sync server-side preferences on load
  useEffect(() => {
    if (prefsData) {
      // Merge server data with defaults to ensure all channels/categories are represented
      const merged: NotificationPreferences = { ...DEFAULT_PREFS };
      for (const channelId of Object.keys(DEFAULT_PREFS)) {
        if (prefsData[channelId]) {
          merged[channelId] = {
            enabled: prefsData[channelId].enabled ?? true,
            categories: {
              ...DEFAULT_PREFS[channelId].categories,
              ...(prefsData[channelId].categories || {}),
            },
          };
        }
      }
      setSettings(merged);
    }
  }, [prefsData]);

  const handleChannelToggle = useCallback(async (channelId: string, value: boolean) => {
    const saveKey = `channel-${channelId}`;
    setSavingItems(prev => new Set(prev).add(saveKey));

    logEvent('preference_toggled', { type: 'channel', channel: channelId, enabled: value });

    const prevSettings = settings;
    const next: NotificationPreferences = {
      ...settings,
      [channelId]: { ...settings[channelId], enabled: value },
    };
    setSettings(next);

    try {
      await updatePrefs({ preferences: next }).unwrap();
      dispatch(showToast(value ? `${channelId === 'push' ? 'Push' : channelId === 'inapp' ? 'In-App' : 'Real-Time'} notifications enabled` : `${channelId === 'push' ? 'Push' : channelId === 'inapp' ? 'In-App' : 'Real-Time'} notifications disabled`));
    } catch {
      setSettings(prevSettings);
      dispatch(showToast('Failed to save preference'));
      logEvent('preference_save_failed', { channel: channelId, error: 'api_error' });
    } finally {
      setTimeout(() => setSavingItems(prev => { const n = new Set(prev); n.delete(saveKey); return n; }), 1200);
    }
  }, [settings, updatePrefs, dispatch]);

  const handleCategoryToggle = useCallback(async (categoryId: string, value: boolean) => {
    const saveKey = `category-${categoryId}`;
    setSavingItems(prev => new Set(prev).add(saveKey));

    logEvent('preference_toggled', { type: 'category', category: categoryId, enabled: value });

    const prevSettings = settings;
    // Toggle category across all channels
    const next: NotificationPreferences = { ...settings };
    for (const channelId of Object.keys(next)) {
      next[channelId] = {
        ...next[channelId],
        categories: {
          ...(next[channelId].categories || {}),
          [categoryId]: value,
        },
      };
    }
    setSettings(next);

    try {
      await updatePrefs({ preferences: next }).unwrap();
      dispatch(showToast(value ? `${categoryId.charAt(0).toUpperCase() + categoryId.slice(1)} notifications enabled` : `${categoryId.charAt(0).toUpperCase() + categoryId.slice(1)} notifications disabled`));
    } catch {
      setSettings(prevSettings);
      dispatch(showToast('Failed to save preference'));
      logEvent('preference_save_failed', { category: categoryId, error: 'api_error' });
    } finally {
      setTimeout(() => setSavingItems(prev => { const n = new Set(prev); n.delete(saveKey); return n; }), 1200);
    }
  }, [settings, updatePrefs, dispatch]);

  // Derive category state: category is "on" if enabled in at least one channel
  const getCategoryEnabled = useCallback((categoryId: string): boolean => {
    for (const channelId of Object.keys(settings)) {
      const ch = settings[channelId];
      if (ch?.enabled && (ch.categories as any)?.[categoryId]) {
        return true;
      }
    }
    return false;
  }, [settings]);

  if (isLoading) {
    return (
      <View style={s.container}>
        <ScreenHeader title="Notification Preferences" showBackButton />
        <View style={s.loader}><ActivityIndicator size="large" color={Colors.primary} /></View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.container}>
        <ScreenHeader title="Notification Preferences" showBackButton />
        <ErrorState message="Failed to load preferences" onRetry={refetch} screenName="NotificationPreferences" />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <ScreenHeader title="Notification Preferences" showBackButton />

      <ScrollView style={s.content} showsVerticalScrollIndicator={false}>
        {/* Section: Channels */}
        <Text style={s.sectionTitle}>Channels</Text>
        <Text style={s.sectionSubtitle}>Choose how you want to receive notifications</Text>

        {CHANNELS.map(channel => {
          const isEnabled = settings[channel.id]?.enabled ?? true;
          const isSaving = savingItems.has(`channel-${channel.id}`);

          return (
            <View key={channel.id} style={s.card}>
              <View style={s.cardRow}>
                <View style={s.cardInfo}>
                  <Text style={s.cardTitle}>{channel.label}</Text>
                  <Text style={s.cardDescription}>{channel.description}</Text>
                </View>
                <View style={s.cardActions}>
                  {isSaving && <Text style={s.savedBadge}>✓</Text>}
                  <Switch
                    value={isEnabled}
                    onValueChange={(val) => handleChannelToggle(channel.id, val)}
                    trackColor={{ false: Colors.border, true: Colors.successLight }}
                    thumbColor={isEnabled ? Colors.success : Colors.textMuted}
                  />
                </View>
              </View>
            </View>
          );
        })}

        {/* Section: Categories */}
        <Text style={[s.sectionTitle, { marginTop: 24 }]}>Categories</Text>
        <Text style={s.sectionSubtitle}>Select which types of notifications you want to receive</Text>

        {CATEGORIES.map(category => {
          const isEnabled = getCategoryEnabled(category.id);
          const isSaving = savingItems.has(`category-${category.id}`);

          return (
            <View key={category.id} style={s.card}>
              <View style={s.cardRow}>
                <View style={s.cardInfo}>
                  <Text style={s.cardTitle}>{category.title}</Text>
                  <Text style={s.cardDescription}>{category.description}</Text>
                </View>
                <View style={s.cardActions}>
                  {isSaving && <Text style={s.savedBadge}>✓</Text>}
                  <Switch
                    value={isEnabled}
                    onValueChange={(val) => handleCategoryToggle(category.id, val)}
                    trackColor={{ false: Colors.border, true: Colors.successLight }}
                    thumbColor={isEnabled ? Colors.success : Colors.textMuted}
                  />
                </View>
              </View>
            </View>
          );
        })}

        {/* Info footer */}
        <View style={s.infoFooter}>
          <Text style={s.infoText}>
            Critical notifications (payment failures, security alerts) will always be delivered regardless of your preferences.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 12 },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardInfo: { flex: 1, marginRight: 12 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  cardDescription: { fontSize: 12, color: Colors.textSecondary, marginTop: 3, lineHeight: 17 },
  cardActions: { flexDirection: 'row', alignItems: 'center' },
  savedBadge: { fontSize: 14, color: Colors.success, fontWeight: '700', marginRight: 8 },
  infoFooter: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    padding: 14,
    marginTop: 16,
  },
  infoText: { fontSize: 12, color: Colors.textMuted, lineHeight: 18, textAlign: 'center' },
});
