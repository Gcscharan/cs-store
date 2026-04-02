import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import type { OrdersStackParamList } from './types';
import OrdersScreen from '../screens/orders/OrdersListScreen';
import OrderDetailScreen from '../screens/orders/OrderDetailScreen';
import OrderTrackingScreen from '../screens/orders/OrderTrackingScreen';

const Stack = createStackNavigator<OrdersStackParamList>();

export default function OrdersNavigator() {
  return (
    <Stack.Navigator id="OrdersStack" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Orders" component={OrdersScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
    </Stack.Navigator>
  );
}
