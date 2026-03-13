import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  Alert,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import * as SecureStore from 'expo-secure-store';
import { logout } from '../../store/slices/authSlice';
import type { RootState } from '../../store';

const MENU = [
  { icon: '📦', label: 'My Orders', screen: 'Orders' },
  { icon: '📍', label: 'Addresses', screen: null },
  { icon: '💳', label: 'Payment Methods', screen: null },
  { icon: '🔔', label: 'Notifications', screen: null },
  { icon: '🌐', label: 'Language', screen: null },
  { icon: '❓', label: 'Help & Support', screen: null },
];

export default function AccountScreen({ navigation }: any) {
  const dispatch = useDispatch();
  const { user } = useSelector((s: RootState) => s.auth);

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await SecureStore.deleteItemAsync('accessToken');
          await SecureStore.deleteItemAsync('refreshToken');
          dispatch(logout());
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Account</Text>
      <View style={styles.profile}>
        {user?.avatar ? (
          <Image source={{ uri: user.avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </Text>
          </View>
        )}
        <View>
          <Text style={styles.name}>{user?.name || 'Guest'}</Text>
          <Text style={styles.contact}>{user?.phone || user?.email || ''}</Text>
        </View>
      </View>
      {MENU.map(item => (
        <TouchableOpacity
          key={item.label}
          style={styles.menuItem}
          onPress={() => item.screen && navigation.navigate(item.screen)}
        >
          <Text style={styles.menuIcon}>{item.icon}</Text>
          <Text style={styles.menuLabel}>{item.label}</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '700', margin: 16 },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    backgroundColor: '#fff8f5',
    margin: 16,
    borderRadius: 16,
  },
  avatar: { width: 60, height: 60, borderRadius: 30 },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E95C1E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { color: '#fff', fontSize: 24, fontWeight: '700' },
  name: { fontSize: 18, fontWeight: '700', color: '#222' },
  contact: { fontSize: 14, color: '#888', marginTop: 2 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#f5f5f5',
    gap: 12,
  },
  menuIcon: { fontSize: 20, width: 28 },
  menuLabel: { flex: 1, fontSize: 16, color: '#333' },
  chevron: { fontSize: 22, color: '#ccc' },
  logoutBtn: {
    margin: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E95C1E',
    alignItems: 'center',
  },
  logoutText: { color: '#E95C1E', fontSize: 16, fontWeight: '600' },
});
