import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useGetOrdersQuery } from '../../store/api';

const STATUS_COLORS: Record<string, string> = {
  DELIVERED: '#2e7d32',
  CANCELLED: '#c62828',
  IN_TRANSIT: '#1565c0',
  CONFIRMED: '#e65100',
  PENDING: '#f57f17',
};

export default function OrdersListScreen({ navigation }: any) {
  const { data, isLoading } = useGetOrdersQuery();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#E95C1E" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>My Orders</Text>
      <FlatList
        data={data?.orders || []}
        keyExtractor={o => o.orderId}
        ListEmptyComponent={<Text style={styles.empty}>No orders yet</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('OrderDetail', { orderId: item.orderId })}
          >
            <View style={styles.cardTop}>
              <Text style={styles.orderId}>#{item.orderId}</Text>
              <Text
                style={[styles.status, { color: STATUS_COLORS[item.status] || '#666' }]}
              >
                {item.status}
              </Text>
            </View>
            <Text style={styles.items}>{item.items?.length} items</Text>
            <Text style={styles.amount}>₹{item.totalAmount}</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', margin: 16 },
  empty: { textAlign: 'center', color: '#888', marginTop: 60, fontSize: 16 },
  card: {
    margin: 12,
    marginBottom: 0,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  orderId: { fontSize: 14, fontWeight: '600', color: '#333' },
  status: { fontSize: 13, fontWeight: '700' },
  items: { fontSize: 13, color: '#888' },
  amount: { fontSize: 17, fontWeight: '800', color: '#222', marginTop: 4 },
});
