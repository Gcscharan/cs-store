import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { Colors } from '../../constants/colors';
import { useGetProfileQuery } from '../../api/profileApi';
import { logout } from '../../store/slices/authSlice';
import { storage } from '../../utils/storage';
import type { ProfileNavigationProp, MainTabNavigationProp } from '../../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/ScreenHeader';
import { persistor } from '../../store';
import { baseApi } from '../../api/baseApi';
import type { RootState } from '../../store';

const MENU = [ 
  { icon: 'cube-outline', label: 'My Orders', screen: 'Orders' }, 
  { icon: 'location-outline', label: 'Saved Addresses', screen: 'Addresses' }, 
  { icon: 'notifications-outline', label: 'Notifications', screen: 'Notifications' }, 
  { icon: 'gift-outline', label: 'Refer & Earn', screen: 'ReferEarn' }, 
  { icon: 'settings-outline', label: 'Settings', screen: 'Settings' }, 
  { icon: 'person-outline', label: 'Edit Profile', screen: 'EditProfile' }, 
  { icon: 'help-circle-outline', label: 'Help & Support', screen: 'Help' }, 
  { icon: 'call-outline', label: 'Contact Us', screen: 'Contact' }, 
  { icon: 'refresh-outline', label: 'Returns & Cancellation', screen: 'Cancellation' }, 
  { icon: 'shield-checkmark-outline', label: 'Privacy Policy', screen: 'Privacy' }, 
  { icon: 'document-text-outline', label: 'Terms & Conditions', screen: 'Terms' }, 
  { icon: 'information-circle-outline', label: 'About Vyapara Setu', screen: 'About' }, 
];

const AccountScreen: React.FC = () => {
  const navigation = useNavigation<ProfileNavigationProp>();
  const tabNav = useNavigation<MainTabNavigationProp>();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);

  const { data: profileData, isLoading, isFetching, refetch, error } = useGetProfileQuery();

  const onLogout = async () => {
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
  };

  const getInitial = () => {
    if (profileData?.name) {
      return profileData.name.charAt(0).toUpperCase();
    }
    return 'U';
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
        <Text style={styles.errorText}>Failed to load profile</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Account" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={refetch}
            colors={[Colors.primary]}
          />
        }
      >
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitial()}</Text>
          </View>
          <Text style={styles.userName}>{profileData?.name || 'User'}</Text>
          <Text style={styles.userEmail}>{profileData?.email || 'No email'}</Text>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          {MENU.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={() => {
                if (item.screen === 'Orders') {
                  tabNav.navigate('Orders');
                } else {
                  navigation.navigate(item.screen as any);
                }
              }}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name={item.icon as any} size={22} color={Colors.primary} style={{ marginRight: 12 }} />
                <Text style={styles.menuLabel}>{item.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={onLogout} activeOpacity={0.9}>
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.white,
    marginTop: 8,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 12,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.white,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  menuSection: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingVertical: 8,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuLabel: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.error,
    marginLeft: 8,
  },
});

export default AccountScreen;
