import React from 'react'; 
import { NavigationContainer, NavigationState, createNavigationContainerRef } from '@react-navigation/native'; 
import { createStackNavigator } from '@react-navigation/stack'; 
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'; 
import { Text, View, Platform } from 'react-native'; 
import { useSelector } from 'react-redux'; 
import type { RootState } from '../store'; 
import { logEvent } from '../utils/analytics';
 
// Auth 
import LoginScreen from '../screens/auth/LoginScreen'; 
import SignupScreen from '../screens/auth/SignupScreen'; 
 
// Tabs 
import HomeScreen from '../screens/home/HomeScreen'; 
import CategoriesScreen from '../screens/products/CategoriesScreen'; 
import CartScreen from '../screens/cart/CartScreen'; 
import OrdersListScreen from '../screens/orders/OrdersListScreen'; 
import AccountScreen from '../screens/profile/AccountScreen'; 
 
// Products 
import ProductDetailScreen from '../screens/products/ProductDetailScreen'; 
import SearchScreen from '../screens/search/SearchScreen'; 
 
// Checkout + Address 
import CheckoutScreen from '../screens/checkout/CheckoutScreen'; 
import AddressesScreen from '../screens/address/AddressesScreen'; 
import AddAddressScreen from '../screens/address/AddAddressScreen'; 
 
// Orders 
import OrderDetailScreen from '../screens/orders/OrderDetailScreen'; 
import OrderSuccessScreen from '../screens/orders/OrderSuccessScreen'; 
import OrderTrackingScreen from '../screens/orders/OrderTrackingScreen'; 
 
// Profile 
import EditProfileScreen from '../screens/profile/EditProfileScreen'; 
import NotificationsScreen from '../screens/notifications/NotificationsScreen'; 
import SettingsScreen from '../screens/settings/SettingsScreen'; 
import NotificationPreferencesScreen from '../screens/settings/NotificationPreferencesScreen';
import CustomerDashboardScreen from '../screens/home/CustomerDashboardScreen';
 
// Info screens 
import AboutScreen from '../screens/info/AboutScreen'; 
import HelpSupportScreen from '../screens/info/HelpSupportScreen'; 
import PrivacyPolicyScreen from '../screens/info/PrivacyPolicyScreen'; 
import TermsScreen from '../screens/info/TermsScreen'; 
import CancellationScreen from '../screens/info/CancellationScreen'; 
import ContactScreen from '../screens/info/ContactScreen'; 
import ReferEarnScreen from '../screens/info/ReferEarnScreen'; 
 
import AdminNavigator from './AdminNavigator';
import DeliveryNavigator from './DeliveryNavigator';
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import LoadingScreen from '../screens/common/LoadingScreen';
import DeliveryLoginScreen from '../screens/auth/DeliveryLoginScreen';
import DeliverySignupScreen from '../screens/auth/DeliverySignupScreen';

import WriteReviewScreen from '../screens/reviews/WriteReviewScreen';
import AllReviewsScreen from '../screens/reviews/AllReviewsScreen';

const Stack = createStackNavigator(); 
const Tab = createBottomTabNavigator(); 

export const navigationRef = createNavigationContainerRef<any>();

// Helper function to get the active route name from the navigation state
function getActiveRouteName(state: NavigationState | undefined): string | null {
    if (!state) {
        return null;
    }
    const route = state.routes[state.index];

    if (route.state) {
        // @ts-ignore
        return getActiveRouteName(route.state);
    }

    return route.name;
}
 
function CartBadge({ count }: { count: number }) { 
  return ( 
    <View> 
      <Text style={{ fontSize: 22 }}>🛒</Text> 
      {count > 0 && ( 
        <View style={{ 
          position: 'absolute', top: -4, right: -8, 
          backgroundColor: '#E95C1E', borderRadius: 8, 
          minWidth: 16, height: 16, 
          justifyContent: 'center', alignItems: 'center', 
        }}> 
          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}> 
            {count > 9 ? '9+' : count} 
          </Text> 
        </View> 
      )} 
    </View> 
  ); 
} 
 
function CustomerTabs() { 
  const cartCount = useSelector((s: RootState) => s.cart.items.length); 
  return ( 
    <Tab.Navigator id="CustomerTabs" screenOptions={{ 
      headerShown: false, 
      tabBarStyle: { 
        height: Platform.OS === 'ios' ? 88 : 68,
        paddingBottom: Platform.OS === 'ios' ? 28 : 12,
        paddingTop: 10,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      }, 
      tabBarLabelStyle: { 
        fontSize: 11, 
        fontWeight: '600',
        marginTop: 4,
      }, 
      tabBarActiveTintColor: '#E95C1E', 
      tabBarInactiveTintColor: '#999', 
    }}> 
      <Tab.Screen name="Home" component={HomeScreen} 
        options={{ 
          tabBarIcon: () => <Text style={{ fontSize: 22 }}>🏠</Text>, 
          tabBarLabel: 'Home', 
        }} /> 
      <Tab.Screen name="Categories" component={CategoriesScreen} 
        options={{ 
          tabBarIcon: () => <Text style={{ fontSize: 22 }}>📋</Text>, 
          tabBarLabel: 'Categories', 
        }} /> 
      <Tab.Screen name="Cart" component={CartScreen} 
        options={{ 
          tabBarIcon: () => <CartBadge count={cartCount} />, 
          tabBarLabel: 'Cart', 
        }} /> 
      <Tab.Screen name="Orders" component={OrdersListScreen} 
        options={{ 
          tabBarIcon: () => <Text style={{ fontSize: 22 }}>📦</Text>, 
          tabBarLabel: 'Orders', 
        }} /> 
      <Tab.Screen name="Account" component={AccountScreen} 
        options={{ 
          tabBarIcon: () => <Text style={{ fontSize: 22 }}>👤</Text>, 
          tabBarLabel: 'Account', 
        }} /> 
    </Tab.Navigator> 
  ); 
} 
 
export function RootNavigator() { 
  const { status, user } = useSelector((s: RootState) => s.auth); 
  const routeNameRef = React.useRef<string | null>(null);

  return ( 
    <NavigationContainer
      ref={navigationRef}
      onStateChange={(state) => {
        const currentRouteName = getActiveRouteName(state);
        if (routeNameRef.current !== currentRouteName) {
          routeNameRef.current = currentRouteName;
          if(currentRouteName){
            logEvent('screen_view', {
              screen_name: currentRouteName,
              screen_class: currentRouteName,
            });
          }
        }
      }}
    > 
      <Stack.Navigator id="RootStack" screenOptions={{ headerShown: false }}> 
        {status === 'LOADING' ? (
          <Stack.Screen name="Loading" component={LoadingScreen} />
        ) : status === 'GOOGLE_AUTH_ONLY' ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : status === 'ACTIVE' ? ( 
          <> 
            {user?.role === 'admin' ? (
              <Stack.Screen name="Admin" component={AdminNavigator} />
            ) : user?.role === 'delivery' ? (
              <Stack.Screen name="Delivery" component={DeliveryNavigator} />
            ) : (
              <Stack.Screen name="Main" component={CustomerTabs} />
            )}
            <Stack.Screen name="Search" component={SearchScreen} /> 
            <Stack.Screen name="ProductDetail" component={ProductDetailScreen} /> 
            <Stack.Screen name="WriteReview" component={WriteReviewScreen} /> 
            <Stack.Screen name="AllReviews" component={AllReviewsScreen} /> 
            <Stack.Screen name="Checkout" component={CheckoutScreen} /> 
            <Stack.Screen name="Addresses" component={AddressesScreen} /> 
            <Stack.Screen name="AddAddress" component={AddAddressScreen} /> 
            <Stack.Screen name="OrderSuccess" component={OrderSuccessScreen} 
              options={{ gestureEnabled: false }} /> 
            <Stack.Screen name="OrderDetail" component={OrderDetailScreen} /> 
            <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} /> 
            <Stack.Screen name="EditProfile" component={EditProfileScreen} /> 
            <Stack.Screen name="Notifications" component={NotificationsScreen} /> 
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} />
            <Stack.Screen name="CustomerDashboard" component={CustomerDashboardScreen} /> 
            <Stack.Screen name="ReferEarn" component={ReferEarnScreen} /> 
            <Stack.Screen name="About" component={AboutScreen} /> 
            <Stack.Screen name="Help" component={HelpSupportScreen} /> 
            <Stack.Screen name="Privacy" component={PrivacyPolicyScreen} /> 
            <Stack.Screen name="Terms" component={TermsScreen} /> 
            <Stack.Screen name="Cancellation" component={CancellationScreen} /> 
            <Stack.Screen name="Contact" component={ContactScreen} /> 
          </> 
        ) : ( 
          <> 
            <Stack.Screen name="Login" component={LoginScreen} 
              options={{ gestureEnabled: false }} /> 
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="DeliveryLogin" component={DeliveryLoginScreen} />
            <Stack.Screen name="DeliverySignup" component={DeliverySignupScreen} /> 
          </> 
        )} 
      </Stack.Navigator> 
    </NavigationContainer> 
  ); 
} 
