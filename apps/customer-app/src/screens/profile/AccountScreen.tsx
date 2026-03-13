import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  Image, Alert, ScrollView,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import * as SecureStore from 'expo-secure-store';
import { logout } from '../../store/slices/authSlice';
import type { RootState } from '../../store';

const MENU = [
  { icon: '📦', label: 'My Orders', screen: 'Orders' },
  { icon: '📍', label: 'Saved Addresses', screen: 'Addresses' },
  { icon: '�', label: 'Edit Profile', screen: 'EditProfile' },
  { icon: '🔔', label: 'Notifications', screen: 'Notifications' },
  { icon: '⚙️', label: 'Settings', screen: 'Settings' },
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
    <SafeAreaView style={s.container}>
      <ScrollView>
        <Text style={s.title}>Account</Text>

        {/* Profile Card */}
        <TouchableOpacity
          style={s.profile}
          onPress={() => navigation.navigate('EditProfile')}
        >
          {user?.avatar ? (
            <Image source={{ uri: user.avatar }} style={s.avatar} />
          ) : (
            <View style={s.avatarPlaceholder}>
              <Text style={s.avatarInitial}>
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{user?.name || 'Guest'}</Text>
            <Text style={s.contact}>{user?.phone || user?.email || ''}</Text>
          </View>
          <Text style={s.chevron}>›</Text>
        </TouchableOpacity>

        {/* Quick Actions */}
        <View style={s.quickActions}>
          <TouchableOpacity
            style={s.quickBtn}
            onPress={() => navigation.navigate('Orders')}
          >
            <Text style={s.quickIcon}>📦</Text>
            <Text style={s.quickLabel}>Orders</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.quickBtn}
            onPress={() => navigation.navigate('Addresses')}
          >
            <Text style={s.quickIcon}>📍</Text>
            <Text style={s.quickLabel}>Addresses</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.quickBtn}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Text style={s.quickIcon}>🔔</Text>
            <Text style={s.quickLabel}>Alerts</Text>
          </TouchableOpacity>
        </View>

        {/* Menu */}
        <View style={s.menuSection}>
          {MENU.map(item => (
            <TouchableOpacity
              key={item.label}
              style={s.menuItem}
              onPress={() => item.screen && navigation.navigate(item.screen)}
            >
              <Text style={s.menuIcon}>{item.icon}</Text>
              <Text style={s.menuLabel}>{item.label}</Text>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Text style={s.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  title: { fontSize: 22, fontWeight: '700', margin: 16, color: '#333' },
  profile: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 18, backgroundColor: '#fff', marginHorizontal: 16,
    borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.06,
    shadowRadius: 8, elevation: 2,
  },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#E95C1E', justifyContent: 'center', alignItems: 'center',
  },
  avatarInitial: { color: '#fff', fontSize: 24, fontWeight: '700' },
  name: { fontSize: 17, fontWeight: '700', color: '#222' },
  contact: { fontSize: 14, color: '#888', marginTop: 2 },
  chevron: { fontSize: 22, color: '#ccc' },
  quickActions: {
    flexDirection: 'row', justifyContent: 'space-around',
    padding: 16, marginHorizontal: 16, marginTop: 12,
    backgroundColor: '#fff', borderRadius: 14,
  },
  quickBtn: { alignItems: 'center', gap: 6 },
  quickIcon: { fontSize: 26 },
  quickLabel: { fontSize: 12, color: '#666', fontWeight: '500' },
  menuSection: {
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 16,
    borderRadius: 14, overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderBottomWidth: 1, borderColor: '#f5f5f5', gap: 12,
  },
  menuIcon: { fontSize: 20, width: 28 },
  menuLabel: { flex: 1, fontSize: 15, color: '#333' },
  logoutBtn: {
    margin: 24, padding: 16, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E95C1E', alignItems: 'center',
  },
  logoutText: { color: '#E95C1E', fontSize: 16, fontWeight: '600' },
});
