import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { ProfileStackParamList } from './types';
import { Colors } from '../constants/colors';

// Import screens
import ProfileScreen from '../screens/profile/AccountScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import AddressesScreen from '../screens/address/AddressesScreen';
import AddAddressScreen from '../screens/address/AddAddressScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import ReferEarnScreen from '../screens/info/ReferEarnScreen';
import AboutScreen from '../screens/info/AboutScreen';
import HelpSupportScreen from '../screens/info/HelpSupportScreen';
import PrivacyPolicyScreen from '../screens/info/PrivacyPolicyScreen';
import TermsScreen from '../screens/info/TermsScreen';
import CancellationScreen from '../screens/info/CancellationScreen';
import ContactScreen from '../screens/info/ContactScreen';

const Stack = createStackNavigator<ProfileStackParamList>();

const ProfileNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      id="ProfileStack"
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: Colors.white,
          shadowColor: Colors.border,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 1,
          shadowRadius: 0,
          elevation: 2,
        },
        headerTintColor: Colors.textPrimary,
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 17,
        },
        cardStyle: {
          backgroundColor: Colors.background,
        },
      }}
    >
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerShown: false, // Profile is the tab root, no header needed
        }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{
          title: 'Edit Profile',
        }}
      />
      <Stack.Screen
        name="Addresses"
        component={AddressesScreen}
        options={{
          title: 'My Addresses',
        }}
      />
      <Stack.Screen
        name="AddAddress"
        component={AddAddressScreen}
        options={({ route }) => ({
          title: route.params?.addressId ? 'Edit Address' : 'Add Address',
        })}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: 'Notifications',
        }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
        }}
      />
      <Stack.Screen
        name="ReferEarn"
        component={ReferEarnScreen}
        options={{
          title: 'Refer & Earn',
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
};

export default ProfileNavigator;
