import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator, RefreshControl,
} from 'react-native';
import {
  useGetNotificationsQuery, useMarkNotificationReadMutation, useMarkAllReadMutation,
} from '../../store/api';

export default function NotificationsScreen({ navigation }: any) {
  const { data, isLoading, refetch } = useGetNotificationsQuery();
  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead] = useMarkAllReadMutation();

  const notifications = data?.notifications || data || [];

  const handleMarkAllRead = async () => {
    try {
      await markAllRead().unwrap();
    } catch (e) {
      // ignore
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[s.card, !item.read && s.cardUnread]}
      onPress={() => markRead(item._id || item.id)}
    >
      <View style={s.iconWrap}>
        <Text style={s.icon}>
          {item.type === 'order' ? '📦' : item.type === 'promo' ? '🎉' : '🔔'}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.title}>{item.title}</Text>
        <Text style={s.body} numberOfLines={2}>{item.body}</Text>
        <Text style={s.time}>
          {new Date(item.createdAt).toLocaleString()}
        </Text>
      </View>
      {!item.read && <View style={s.unreadDot} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Notifications</Text>
        {notifications.some((n: any) => !n.read) && (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={s.markAllBtn}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ margin: 40 }} size="large" color="#E95C1E" />
      ) : notifications.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyEmoji}>🔔</Text>
          <Text style={s.emptyTxt}>No notifications yet</Text>
          <Text style={s.emptySub}>We'll notify you when something arrives!</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n._id || n.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', alignItems: 'center',
    padding: 16, backgroundColor: '#fff', gap: 12 },
  back: { fontSize: 24, color: '#333' },
  title: { flex: 1, fontSize: 18, fontWeight: '700' },
  markAllBtn: { color: '#E95C1E', fontWeight: '600', fontSize: 13 },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12 },
  cardUnread: { backgroundColor: '#fff8f5', borderWidth: 1, borderColor: '#ffe4d9' },
  iconWrap: { width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  icon: { fontSize: 22 },
  title: { fontSize: 15, fontWeight: '600', color: '#333' },
  body: { fontSize: 13, color: '#666', marginTop: 4, lineHeight: 18 },
  time: { fontSize: 12, color: '#888', marginTop: 6 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E95C1E' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyEmoji: { fontSize: 56 },
  emptyTxt: { fontSize: 17, color: '#666' },
  emptySub: { fontSize: 14, color: '#999' },
});
