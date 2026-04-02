import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { RootState } from '../../store';
import { logout } from '../../store/slices/authSlice';
import { storage } from '../../utils/storage';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { persistor } from '../../store';
import { baseApi } from '../../api/baseApi';

type DeliveryStackParamList = {
  DeliveryDashboard: undefined;
  DeliveryProfile: undefined;
  DeliveryEmergency: undefined;
};

type NavigationProp = StackNavigationProp<DeliveryStackParamList>;

interface MenuItem {
  icon: string;
  label: string;
  onPress: () => void;
  color?: string;
  showArrow?: boolean;
}

const DeliveryMoreTab: React.FC = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation<NavigationProp>();
  const user = useSelector((state: RootState) => state.auth.user);

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            // 1. Clear RTK Query cache
            dispatch(baseApi.util.resetApiState());
            
            // 2. Clear AsyncStorage persisted state
            await persistor.purge();
            
            // 3. Clear Redux state
            dispatch(logout());
            
            // 4. Remove tokens (existing - keep it)
            await storage.removeItem('accessToken');
            await storage.removeItem('refreshToken');
            
            // 5. Minimal logging
            console.log("🚪 LOGOUT COMPLETE", {userId: user?.id, time: Date.now()});
          },
        },
      ]
    );
  };

  const menuItems: MenuItem[] = [
    {
      icon: 'person',
      label: 'My Profile',
      onPress: () => navigation.navigate('DeliveryProfile'),
      showArrow: true,
    },
    {
      icon: 'camera',
      label: 'Update Selfie',
      onPress: () => navigation.navigate('DeliveryProfile'),
      showArrow: true,
    },
    {
      icon: 'alert-circle',
      label: 'Emergency',
      onPress: () => navigation.navigate('DeliveryEmergency'),
      color: Colors.error,
      showArrow: true,
    },
    {
      icon: 'log-out',
      label: 'Logout',
      onPress: handleLogout,
      color: Colors.error,
      showArrow: false,
    },
  ];

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={32} color={Colors.white} />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.userName}>{user?.name || 'Delivery Partner'}</Text>
          <Text style={styles.userPhone}>{user?.phone || 'No phone'}</Text>
        </View>
      </View>

      {/* Menu Items */}
      <View style={styles.menuSection}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.menuItem}
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, item.color && { backgroundColor: `${item.color}15` }, { marginRight: 12 }]}>
                <Ionicons
                  name={item.icon as any}
                  size={20}
                  color={item.color || Colors.primary}
                />
              </View>
              <Text style={[styles.menuLabel, item.color && { color: item.color }]}>
                {item.label}
              </Text>
            </View>
            {item.showArrow && (
              <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* App Version */}
      <Text style={styles.version}>Version 1.0.0</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    marginLeft: 16,
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.white,
  },
  userPhone: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  menuSection: {
    marginTop: 16,
    marginHorizontal: 16,
    backgroundColor: Colors.white,
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 32,
    marginBottom: 20,
  },
});

export default DeliveryMoreTab;
