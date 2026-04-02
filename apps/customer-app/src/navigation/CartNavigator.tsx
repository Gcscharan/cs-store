import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import type { CartStackParamList } from './types';
import CartScreen from '../screens/cart/CartScreen';
import CheckoutScreen from '../screens/checkout/CheckoutScreen';
import OrderSuccessScreen from '../screens/orders/OrderSuccessScreen';
import AddressesScreen from '../screens/address/AddressesScreen';
import AddAddressScreen from '../screens/address/AddAddressScreen';

const Stack = createStackNavigator<CartStackParamList>();

export default function CartNavigator() {
  return (
    <Stack.Navigator id="CartStack" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen name="OrderSuccess" component={OrderSuccessScreen} />
      <Stack.Screen name="Addresses" component={AddressesScreen} />
      <Stack.Screen name="AddAddress" component={AddAddressScreen} />
    </Stack.Navigator>
  );
}
