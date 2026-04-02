import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import useDeliveryLocation from '../hooks/useDeliveryLocation';
import DeliveryDashboardScreen from '../screens/delivery/DeliveryDashboardScreen';
import DeliveryProfileScreen from '../screens/delivery/DeliveryProfileScreen';
import DeliveryEmergencyScreen from '../screens/delivery/DeliveryEmergencyScreen';
import DeliverySelfieScreen from '../screens/delivery/DeliverySelfieScreen';
import DeliverySettingsScreen from '../screens/delivery/DeliverySettingsScreen';
import DeliveryHelpCenterScreen from '../screens/delivery/DeliveryHelpCenterScreen';
import DeliveryKYCScreen from '../screens/delivery/DeliveryKYCScreen';

const Stack = createStackNavigator();

export default function DeliveryNavigator() {
  // Global location tracking for Delivery Partners
  // Always runs when delivery navigator is mounted; relies on routeId check internally
  useDeliveryLocation(true, true);

  return (
    <Stack.Navigator id="DeliveryStack">
      <Stack.Screen
        name="DeliveryDashboard"
        component={DeliveryDashboardScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DeliveryProfile"
        component={DeliveryProfileScreen}
        options={{
          title: 'My Profile',
        }}
      />
      <Stack.Screen
        name="DeliveryEmergency"
        component={DeliveryEmergencyScreen}
        options={{
          title: 'Emergency',
        }}
      />
      <Stack.Screen
        name="DeliverySelfie"
        component={DeliverySelfieScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DeliverySettings"
        component={DeliverySettingsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DeliveryHelpCenter"
        component={DeliveryHelpCenterScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DeliveryKYC"
        component={DeliveryKYCScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

