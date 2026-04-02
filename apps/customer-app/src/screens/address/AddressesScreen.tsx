import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Colors } from '../../constants/colors';
import {
  useGetAddressesQuery,
  useDeleteAddressMutation,
  useSetDefaultAddressMutation,
  Address,
} from '../../api/addressesApi';
import type { ProfileNavigationProp } from '../../navigation/types';

const AddressesScreen: React.FC = () => {
  const navigation = useNavigation<ProfileNavigationProp>();
  const { data: addressData, isLoading, refetch } = useGetAddressesQuery();
  const addresses = addressData?.addresses || [];
  const defaultAddressId = addressData?.defaultAddressId || null;
  const [deleteAddress, { isLoading: isDeleting }] = useDeleteAddressMutation();
  const [setDefaultAddress, { isLoading: isSettingDefault }] = useSetDefaultAddressMutation();

  // Refetch addresses when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const handleAddNew = () => {
    navigation.navigate('AddAddress', {});
  };

  const handleEdit = (address: Address) => {
    navigation.navigate('AddAddress', { addressId: (address as any)._id || (address as any).id });
  };

  const handleDelete = (address: Address) => {
    Alert.alert(
      'Delete Address',
      `Are you sure you want to delete this address?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAddress((address as any)._id || (address as any).id).unwrap();
              Alert.alert('Success', 'Address deleted successfully');
            } catch (error: any) {
              Alert.alert('Error', error?.data?.message || 'Failed to delete address');
            }
          },
        },
      ]
    );
  };

  const handleSetDefault = async (address: Address) => {
    try {
      await setDefaultAddress((address as any)._id || (address as any).id).unwrap();
      Alert.alert('Success', 'Default address updated');
    } catch (error: any) {
      Alert.alert('Error', error?.data?.message || 'Failed to set default address');
    }
  };

  const getLabelColor = (label: string) => {
    switch (label) {
      case 'HOME':
        return '#3b82f6';
      case 'SHOP':
      case 'OFFICE':
        return '#8b5cf6';
      default:
        return '#f97316';
    }
  };

  const getLabelText = (label: string) => {
    switch (label) {
      case 'HOME':
        return 'HOME';
      case 'SHOP':
      case 'OFFICE':
        return 'SHOP';
      default:
        return label;
    }
  };

  const isDefaultAddress = (address: Address): boolean => {
    if (defaultAddressId) {
      return String((address as any)?._id || (address as any).id || '').trim() === String(defaultAddressId).trim();
    }
    return !!address.isDefault;
  };

  const renderAddress = ({ item }: { item: Address }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.name}>{item.name}</Text>
        {isDefaultAddress(item) && (
          <View style={styles.defaultBadge}>
            <Text style={styles.defaultBadgeText}>DEFAULT</Text>
          </View>
        )}
      </View>

      <Text style={styles.addressLine}>{(item as any).addressLine || (item as any).line1 || ''}</Text>
      <Text style={styles.cityState}>
        {item.city}, {item.state} - {item.pincode}
      </Text>
      <Text style={styles.phone}>Phone number: {item.phone}</Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleEdit(item)}
        >
          <Text style={styles.actionEditText}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDelete(item)}
          disabled={isDeleting}
        >
          <Text style={styles.actionDeleteText}>Remove</Text>
        </TouchableOpacity>

        {!isDefaultAddress(item) && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleSetDefault(item)}
            disabled={isSettingDefault}
          >
            <Text style={styles.actionDefaultText}>Set as Default</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📍</Text>
      <Text style={styles.emptyTitle}>No addresses saved</Text>
      <Text style={styles.emptySubtitle}>
        Add an address to get started with checkout
      </Text>
      <TouchableOpacity style={styles.addButton} onPress={handleAddNew}>
        <Text style={styles.addButtonText}>Add Address</Text>
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Saved Addresses" showBackButton />

      <FlatList
        data={addresses}
        keyExtractor={(item) => (item as any)._id || (item as any).id}
        renderItem={renderAddress}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <Text style={styles.mainTitle}>Your Addresses</Text>
            <TouchableOpacity style={styles.addBtn} onPress={handleAddNew}>
              <Text style={styles.addBtnText}>Add a new address</Text>
              <Text style={styles.addBtnArrow}>›</Text>
            </TouchableOpacity>
            <View style={styles.separator} />
            <Text style={styles.subTitle}>Personal Addresses</Text>
          </>
        }
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            colors={[Colors.primary]}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  addBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  addBtnText: {
    fontSize: 16,
  },
  addBtnArrow: {
    fontSize: 20,
    color: Colors.textSecondary,
  },
  separator: {
    height: 10,
    backgroundColor: Colors.background,
    marginVertical: 16,
  },
  subTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  defaultBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  defaultBadgeText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: 'bold',
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  addressLine: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  cityState: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  phone: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actionButton: {
    marginRight: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  actionEditText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  actionDeleteText: {
    color: Colors.error,
    fontSize: 15,
    fontWeight: '600',
  },
  actionDefaultText: {
    color: Colors.success,
    fontSize: 15,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  addButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  addButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default AddressesScreen;
