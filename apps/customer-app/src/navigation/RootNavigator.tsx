import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';

// Auth
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';
// Main tabs
import HomeScreen from '../screens/home/HomeScreen';
import CategoriesScreen from '../screens/products/CategoriesScreen';
import CartScreen from '../screens/cart/CartScreen';
import OrdersListScreen from '../screens/orders/OrdersListScreen';
import AccountScreen from '../screens/profile/AccountScreen';
// Products
import ProductDetailScreen from '../screens/products/ProductDetailScreen';
import SearchScreen from '../screens/search/SearchScreen';
// Checkout
import CheckoutScreen from '../screens/checkout/CheckoutScreen';
// Orders
import OrderSuccessScreen from '../screens/orders/OrderSuccessScreen';
import OrderDetailScreen from '../screens/orders/OrderDetailScreen';
import OrderTrackingScreen from '../screens/orders/OrderTrackingScreen';
// Address
import AddressesScreen from '../screens/address/AddressesScreen';
import AddAddressScreen from '../screens/address/AddAddressScreen';
// Profile
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
// Info screens
import AboutScreen from '../screens/info/AboutScreen';
import HelpSupportScreen from '../screens/info/HelpSupportScreen';
import PrivacyPolicyScreen from '../screens/info/PrivacyPolicyScreen';
import TermsScreen from '../screens/info/TermsScreen';
import CancellationScreen from '../screens/info/CancellationScreen';
import ContactScreen from '../screens/info/ContactScreen';
import ReferEarnScreen from '../screens/info/ReferEarnScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function TabIcon({ emoji, badge }: { emoji: string; badge?: number }) {
  return (
    <>
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      {badge && badge > 0 && (
        <Text style={{ position: 'absolute', top: -4, right: -8,
          backgroundColor: '#E95C1E', color: '#fff', fontSize: 10,
          paddingHorizontal: 5, borderRadius: 8, fontWeight: '700' }}>
          {badge > 9 ? '9+' : badge}
        </Text>
      )}
    </>
  );
}

function CustomerTabs() {
  const { items } = useSelector((s: RootState) => s.cart);
  const cartCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { paddingBottom: 6, height: 60 },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: () => <TabIcon emoji="🏠" />,
          tabBarLabel: 'Home',
        }}
      />
      <Tab.Screen
        name="Categories"
        component={CategoriesScreen}
        options={{
          tabBarIcon: () => <TabIcon emoji="📋" />,
          tabBarLabel: 'Categories',
        }}
      />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{
          tabBarIcon: () => <TabIcon emoji="🛒" badge={cartCount} />,
          tabBarLabel: 'Cart',
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersListScreen}
        options={{
          tabBarIcon: () => <TabIcon emoji="📦" />,
          tabBarLabel: 'Orders',
        }}
      />
      <Tab.Screen
        name="Account"
        component={AccountScreen}
        options={{
          tabBarIcon: () => <TabIcon emoji="👤" />,
          tabBarLabel: 'Account',
        }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { status } = useSelector((s: RootState) => s.auth);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {status === 'ACTIVE' ? (
          <>
            <Stack.Screen name="Main" component={CustomerTabs} />
            {/* Products */}
            <Stack.Screen
              name="ProductDetail"
              component={ProductDetailScreen}
              options={{ headerShown: true, title: 'Product' }}
            />
            <Stack.Screen
              name="Search"
              component={SearchScreen}
              options={{ headerShown: false }}
            />
            {/* Checkout */}
            <Stack.Screen
              name="Checkout"
              component={CheckoutScreen}
              options={{ headerShown: true, title: 'Checkout' }}
            />
            {/* Orders */}
            <Stack.Screen name="OrderSuccess" component={OrderSuccessScreen} />
            <Stack.Screen
              name="OrderDetail"
              component={OrderDetailScreen}
              options={{ headerShown: true, title: 'Order Details' }}
            />
            <Stack.Screen
              name="OrderTracking"
              component={OrderTrackingScreen}
              options={{ headerShown: true, title: 'Track Order' }}
            />
            {/* Address */}
            <Stack.Screen
              name="Addresses"
              component={AddressesScreen}
              options={{ headerShown: true, title: 'Saved Addresses' }}
            />
            <Stack.Screen
              name="AddAddress"
              component={AddAddressScreen}
              options={{ headerShown: true, title: 'Add Address' }}
            />
            {/* Profile */}
            <Stack.Screen
              name="EditProfile"
              component={EditProfileScreen}
              options={{ headerShown: true, title: 'Edit Profile' }}
            />
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{ headerShown: true, title: 'Notifications' }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ headerShown: true, title: 'Settings' }}
            />
            {/* Info screens */}
            <Stack.Screen name="About" component={AboutScreen} options={{ headerShown: true, title: 'About Us' }} />
            <Stack.Screen name="Help" component={HelpSupportScreen} options={{ headerShown: true, title: 'Help & Support' }} />
            <Stack.Screen name="Privacy" component={PrivacyPolicyScreen} options={{ headerShown: true, title: 'Privacy Policy' }} />
            <Stack.Screen name="Terms" component={TermsScreen} options={{ headerShown: true, title: 'Terms & Conditions' }} />
            <Stack.Screen name="Cancellation" component={CancellationScreen} options={{ headerShown: true, title: 'Returns & Cancellation' }} />
            <Stack.Screen name="Contact" component={ContactScreen} options={{ headerShown: true, title: 'Contact Us' }} />
            <Stack.Screen name="ReferEarn" component={ReferEarnScreen} options={{ headerShown: true, title: 'Refer & Earn' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ gestureEnabled: false }} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
