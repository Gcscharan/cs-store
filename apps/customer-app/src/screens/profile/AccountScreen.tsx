import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import * as SecureStore from 'expo-secure-store';
import { logout } from '../../store/slices/authSlice';
import type { RootState } from '../../store';

export default function AccountScreen() {
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
      
      {user && (
        <View style={styles.userInfo}>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.phone}>{user.phone}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.menuItem}>
        <Text>My Orders</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.menuItem}>
        <Text>Addresses</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.menuItem}>
        <Text>Help & Support</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  userInfo: { marginBottom: 24, padding: 16, backgroundColor: '#f5f5f5', borderRadius: 8 },
  name: { fontSize: 18, fontWeight: '600' },
  phone: { color: '#666', marginTop: 4 },
  menuItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  logoutButton: { marginTop: 24, padding: 16, backgroundColor: '#fee2e2', borderRadius: 8, alignItems: 'center' },
  logoutText: { color: '#dc2626', fontWeight: '600' },
});
