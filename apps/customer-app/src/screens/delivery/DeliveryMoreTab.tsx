import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { DELIVERY_COLORS } from '../../constants/deliveryTheme';
import { AppHeader } from '../../components/delivery/AppHeader/AppHeader';
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
      color: DELIVERY_COLORS.danger,
      showArrow: true,
    },
    {
      icon: 'log-out',
      label: 'Logout',
      onPress: handleLogout,
      color: DELIVERY_COLORS.danger,
      showArrow: false,
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <AppHeader title="Profile" />
      <ScrollView>
        {/* Profile info */}
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={28} color={DELIVERY_COLORS.white} />
          </View>
          <View style={styles.profileInfo}>
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
                  color={item.color || DELIVERY_COLORS.primary}
                />
              </View>
              <Text style={[styles.menuLabel, item.color && { color: item.color }]}>
                {item.label}
              </Text>
            </View>
            {item.showArrow && (
              <Ionicons name="chevron-forward" size={20} color={DELIVERY_COLORS.textMuted} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* App Version */}
        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DELIVERY_COLORS.background,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: DELIVERY_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: DELIVERY_COLORS.textPrimary,
  },
  userPhone: {
    fontSize: 13,
    color: DELIVERY_COLORS.textSecondary,
    marginTop: 2,
  },
  menuSection: {
    marginTop: 16,
    marginHorizontal: 16,
    backgroundColor: DELIVERY_COLORS.card,
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: DELIVERY_COLORS.border,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DELIVERY_COLORS.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: DELIVERY_COLORS.textPrimary,
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: DELIVERY_COLORS.textMuted,
    marginTop: 32,
    marginBottom: 20,
  },
});

export default DeliveryMoreTab;
