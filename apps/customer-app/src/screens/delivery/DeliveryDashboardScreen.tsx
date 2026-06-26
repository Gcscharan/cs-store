import React from 'react';
import { StatusBar } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { DELIVERY_COLORS } from '../../constants/deliveryTheme';
import DeliveryHomeTab from './DeliveryHomeTab';
import DeliveryEarningsTab from './DeliveryEarningsTab';
import NotificationsScreen from '../notifications/NotificationsScreen';
import DeliveryMoreTab from './DeliveryMoreTab';

const Tab = createBottomTabNavigator();

const DeliveryDashboardScreen: React.FC = () => {
  return (
    <>
      {/* Dark icons on white background — makes time/battery/signal visible */}
      <StatusBar barStyle="dark-content" backgroundColor={DELIVERY_COLORS.card} />
      <Tab.Navigator id="DeliveryTabs"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: DELIVERY_COLORS.primary,   // orange active
        tabBarInactiveTintColor: DELIVERY_COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: DELIVERY_COLORS.card,           // white tab bar
          borderTopWidth: 1,
          borderTopColor: DELIVERY_COLORS.border,
          paddingBottom: 12,
          paddingTop: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -1 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="DeliveryHome"
        component={DeliveryHomeTab}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="DeliveryEarnings"
        component={DeliveryEarningsTab}
        options={{
          tabBarLabel: 'Earnings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="DeliveryNotifications"
        component={NotificationsScreen}
        options={{
          tabBarLabel: 'Alerts',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="DeliveryMore"
        component={DeliveryMoreTab}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
    </>
  );
};

export default DeliveryDashboardScreen;
