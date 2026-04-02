import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

const CHANNELS = [
  { id: 'push', label: '🔔 Push', color: '#7c3aed' },
  { id: 'sms', label: '💬 SMS', color: '#ea580c' },
  { id: 'email', label: '📧 Email', color: '#2563eb' },
  { id: 'whatsapp', label: '💚 WhatsApp', color: '#22c55e' },
  { id: 'inapp', label: '📱 In-App', color: '#ef4444' },
];

const CATEGORIES = [
  { id: 'myOrders', title: '📦 My Orders', desc: 'Order status & delivery updates' },
  { id: 'reminders', title: '🔔 Reminders', desc: 'Cart, payment & restock reminders', expandable: true,
    subcategories: [
      { id: 'reminders_cart', title: 'Cart Reminders', desc: 'Items waiting in your cart' },
      { id: 'reminders_payment', title: 'Payment Reminders', desc: 'Pending payment notifications' },
      { id: 'reminders_restock', title: 'Restock Alerts', desc: 'Back-in-stock notifications' },
    ],
  },
  { id: 'silentPay', title: '🛡 Silent Pay', desc: 'Security payment notifications' },
  { id: 'recommendations', title: '⭐ Recommendations', desc: 'Personalized product picks' },
  { id: 'newProductAlerts', title: '🆕 New Products', desc: 'Alerts for new arrivals' },
  { id: 'newOffers', title: '🎁 Offers & Deals', desc: 'Promotions and discounts' },
  { id: 'community', title: '👥 Community', desc: 'Community updates' },
  { id: 'feedback', title: '📝 Feedback', desc: 'Review and feedback requests' },
];

const DEFAULT_PREFS: NotificationPreferences = {
  push: { enabled: true, categories: { myOrders: true, reminders: { enabled: true, subcategories: { reminders_cart: true, reminders_payment: true, reminders_restock: true } }, silentPay: true, recommendations: true, newOffers: true, community: false, feedback: true, newProductAlerts: true } },
  sms: { enabled: true, categories: { myOrders: true, reminders: { enabled: false, subcategories: { reminders_cart: false, reminders_payment: false, reminders_restock: false } }, silentPay: false, recommendations: false, newOffers: false, community: false, feedback: false, newProductAlerts: false } },
  email: { enabled: true, categories: { myOrders: true, reminders: { enabled: true, subcategories: { reminders_cart: true, reminders_payment: true, reminders_restock: true } }, silentPay: true, recommendations: true, newOffers: true, community: true, feedback: true, newProductAlerts: true } },
  whatsapp: { enabled: true, categories: { myOrders: true, reminders: { enabled: true, subcategories: { reminders_cart: true, reminders_payment: true, reminders_restock: true } }, silentPay: true, recommendations: true, newOffers: true, community: false, feedback: true, newProductAlerts: true } },
  inapp: { enabled: true, categories: { myOrders: true, reminders: { enabled: true, subcategories: { reminders_cart: true, reminders_payment: true, reminders_restock: true } }, silentPay: true, recommendations: true, newOffers: true, community: true, feedback: true, newProductAlerts: true } },
};

export default function NotificationPreferencesScreen({ navigation }: any) {
  const dispatch = useDispatch<AppDispatch>();
  const [selectedChannel, setSelectedChannel] = useState('push');
  const [settings, setSettings] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['reminders']));
  const [savingItems, setSavingItems] = useState<Set<string>>(new Set());

  const { data: prefsData, isLoading, error, refetch } = useGetNotificationPreferencesQuery();
  const [updatePrefs] = useUpdateNotificationPreferencesMutation();

  useEffect(() => {
    logEvent('screen_view', { screen: 'NotificationPreferences' });
  }, []);

  useEffect(() => {
    if (prefsData) setSettings(prefsData);
  }, [prefsData]);

  const getCategoryValue = useCallback((categoryId: string): boolean => {
    const ch = settings[selectedChannel];
    if (!ch) return false;
    const cats = ch.categories as any;
    if (categoryId === 'reminders') return cats?.reminders?.enabled ?? false;
    return cats?.[categoryId] ?? false;
  }, [settings, selectedChannel]);

  const getSubcategoryValue = useCallback((subcatId: string): boolean => {
    const ch = settings[selectedChannel];
    if (!ch) return false;
    return (ch.categories as any)?.reminders?.subcategories?.[subcatId] ?? false;
  }, [settings, selectedChannel]);

  const handleToggle = useCallback(async (categoryId: string, subcatId?: string, value?: boolean) => {
    const saveKey = subcatId ? `${selectedChannel}-${categoryId}-${subcatId}` : `${selectedChannel}-${categoryId}`;
    setSavingItems(prev => new Set(prev).add(saveKey));

    logEvent('preference_toggled', { channel: selectedChannel, category: categoryId, subcategory: subcatId, enabled: value });

    const prev = settings[selectedChannel] || { enabled: true, categories: {} };
    const prevCats = { ...(prev.categories as any) };

    if (!subcatId) {
      if (categoryId === 'reminders') {
        const r = prevCats.reminders || { enabled: false, subcategories: {} };
        prevCats.reminders = { ...r, enabled: value, subcategories: { reminders_cart: value, reminders_payment: value, reminders_restock: value } };
      } else {
        prevCats[categoryId] = value;
      }
    } else {
      const r = prevCats.reminders || { enabled: true, subcategories: {} };
      prevCats.reminders = { ...r, subcategories: { ...(r.subcategories || {}), [subcatId]: value } };
    }

    const next: NotificationPreferences = { ...settings, [selectedChannel]: { ...prev, categories: prevCats } };
    setSettings(next);

    try {
      await updatePrefs({ preferences: next }).unwrap();
      dispatch(showToast('Preference saved'));
    } catch {
      setSettings(settings); // revert
      dispatch(showToast('Failed to save preference'));
      logEvent('preference_save_failed', { channel: selectedChannel, error: 'api_error' });
    } finally {
      setTimeout(() => setSavingItems(prev => { const n = new Set(prev); n.delete(saveKey); return n; }), 1000);
    }
  }, [settings, selectedChannel, updatePrefs, dispatch]);

  if (isLoading) {
    return (
      <View style={s.container}>
        <ScreenHeader title="Notifications" showBackButton />
        <View style={s.loader}><ActivityIndicator size="large" color={Colors.primary} /></View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.container}>
        <ScreenHeader title="Notifications" showBackButton />
        <ErrorState message="Failed to load preferences" onRetry={refetch} screenName="NotificationPreferences" />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <ScreenHeader title="Notifications" showBackButton />

      {/* Channel Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.channelRow}>
        {CHANNELS.map(ch => (
          <TouchableOpacity
            key={ch.id}
            style={[s.channelChip, selectedChannel === ch.id && { backgroundColor: ch.color }]}
            onPress={() => { setSelectedChannel(ch.id); logEvent('channel_switched', { channel: ch.id }); }}
          >
            <Text style={[s.channelLabel, selectedChannel === ch.id && s.channelLabelActive]}>{ch.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Category Toggles */}
      <ScrollView style={s.content}>
        {CATEGORIES.map(cat => {
          const isEnabled = getCategoryValue(cat.id);
          const isExpanded = expandedSections.has(cat.id);
          const isSaving = savingItems.has(`${selectedChannel}-${cat.id}`);

          return (
            <View key={cat.id} style={s.categoryCard}>
              <View style={s.categoryRow}>
                <View style={s.categoryInfo}>
                  <Text style={s.categoryTitle}>{cat.title}</Text>
                  <Text style={s.categoryDesc}>{cat.desc}</Text>
                </View>
                <View style={s.categoryActions}>
                  {isSaving && <Text style={s.savedBadge}>✓</Text>}
                  <Switch
                    value={isEnabled}
                    onValueChange={(val) => handleToggle(cat.id, undefined, val)}
                    trackColor={{ false: Colors.border, true: Colors.successLight }}
                    thumbColor={isEnabled ? Colors.success : Colors.textMuted}
                  />
                </View>
              </View>

              {cat.expandable && (
                <TouchableOpacity onPress={() => setExpandedSections(prev => {
                  const n = new Set(prev);
                  n.has(cat.id) ? n.delete(cat.id) : n.add(cat.id);
                  return n;
                })}>
                  <Text style={s.expandToggle}>{isExpanded ? '▲ Less' : '▼ More'}</Text>
                </TouchableOpacity>
              )}

              {cat.expandable && isExpanded && cat.subcategories?.map(sub => {
                const subVal = getSubcategoryValue(sub.id);
                const subSaving = savingItems.has(`${selectedChannel}-${cat.id}-${sub.id}`);
                return (
                  <View key={sub.id} style={s.subcategoryRow}>
                    <View style={s.categoryInfo}>
                      <Text style={s.subcatTitle}>{sub.title}</Text>
                      <Text style={s.subcatDesc}>{sub.desc}</Text>
                    </View>
                    <View style={s.categoryActions}>
                      {subSaving && <Text style={s.savedBadge}>✓</Text>}
                      <Switch
                        value={subVal}
                        onValueChange={(val) => handleToggle(cat.id, sub.id, val)}
                        trackColor={{ false: Colors.border, true: Colors.successLight }}
                        thumbColor={subVal ? Colors.success : Colors.textMuted}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: Colors.background, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { marginRight: 12 },
  backText: { fontSize: 16, color: Colors.secondary },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  channelRow: { paddingHorizontal: 12, paddingVertical: 10 },
  channelChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.backgroundDark, borderWidth: 1, borderColor: Colors.border, marginRight: 8 },
  channelLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  channelLabelActive: { color: Colors.white },
  content: { flex: 1, padding: 16 },
  categoryCard: { backgroundColor: Colors.background, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  categoryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryInfo: { flex: 1, marginRight: 12 },
  categoryTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  categoryDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  categoryActions: { flexDirection: 'row', alignItems: 'center' },
  savedBadge: { fontSize: 14, color: Colors.success, fontWeight: '700', marginRight: 8 },
  expandToggle: { fontSize: 12, color: Colors.secondary, fontWeight: '600', marginTop: 8 },
  subcategoryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.surface, marginTop: 8 },
  subcatTitle: { fontSize: 14, fontWeight: '500', color: Colors.textPrimary },
  subcatDesc: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
});
