import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator, Alert,
} from 'react-native';
import {
  useGetAddressesQuery, useDeleteAddressMutation, useSetDefaultAddressMutation,
} from '../../store/api';

export default function AddressesScreen({ navigation, route }: any) {
  const { selectMode, onSelect } = route.params || {};
  const { data, isLoading } = useGetAddressesQuery();
  const [deleteAddress] = useDeleteAddressMutation();
  const [setDefault] = useSetDefaultAddressMutation();

  const addresses = data?.addresses || [];

  const handleDelete = (id: string) => {
    Alert.alert('Delete Address', 'Remove this address?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteAddress(id) },
    ]);
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Saved Addresses</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AddAddress', { onSave: onSelect })}>
          <Text style={s.addNew}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ margin: 40 }} size="large" color="#E95C1E" />
      ) : addresses.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyEmoji}>📍</Text>
          <Text style={s.emptyTxt}>No saved addresses</Text>
          <TouchableOpacity
            style={s.addBtn}
            onPress={() => navigation.navigate('AddAddress')}
          >
            <Text style={s.addBtnTxt}>Add New Address</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(a) => a._id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.card, item.isDefault && s.cardDefault]}
              onPress={() => selectMode ? onSelect?.(item) : null}
            >
              {item.isDefault && (
                <View style={s.defaultBadge}>
                  <Text style={s.defaultBadgeTxt}>Default</Text>
                </View>
              )}
              <Text style={s.name}>{item.name} · {item.phone}</Text>
              <Text style={s.addr}>{item.line1 || item.addressLine}{item.line2 ? `, ${item.line2}` : ''}</Text>
              <Text style={s.addr}>{item.city}, {item.state} - {item.pincode}</Text>
              <View style={s.actions}>
                {!item.isDefault && (
                  <TouchableOpacity onPress={() => setDefault(item._id)}>
                    <Text style={s.actionTxt}>Set Default</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => navigation.navigate('AddAddress', { address: item })}>
                  <Text style={s.actionTxt}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item._id)}>
                  <Text style={[s.actionTxt, { color: '#c62828' }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8' },
  header: { flexDirection: 'row', alignItems: 'center',
    padding: 16, backgroundColor: '#fff', gap: 12 },
  back: { fontSize: 24, color: '#333' },
  title: { flex: 1, fontSize: 18, fontWeight: '700' },
  addNew: { color: '#E95C1E', fontWeight: '700', fontSize: 15 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyEmoji: { fontSize: 56 },
  emptyTxt: { fontSize: 17, color: '#666' },
  addBtn: { backgroundColor: '#E95C1E', paddingHorizontal: 24,
    paddingVertical: 14, borderRadius: 10, marginTop: 8 },
  addBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16,
    marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6 },
  cardDefault: { borderWidth: 1.5, borderColor: '#E95C1E' },
  defaultBadge: { backgroundColor: '#fff3ee', alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, marginBottom: 8 },
  defaultBadgeTxt: { color: '#E95C1E', fontSize: 12, fontWeight: '700' },
  name: { fontSize: 15, fontWeight: '600', color: '#222', marginBottom: 4 },
  addr: { fontSize: 14, color: '#666', lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 16, marginTop: 12,
    paddingTop: 12, borderTopWidth: 1, borderColor: '#f0f0f0' },
  actionTxt: { color: '#E95C1E', fontSize: 14, fontWeight: '600' },
});
