import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import AdminOrdersScreen from '../screens/admin/AdminOrdersScreen';
import AdminOrderDetailScreen from '../screens/admin/AdminOrderDetailScreen';
import AdminProductsScreen from '../screens/admin/AdminProductsScreen';
import AdminCreateProductScreen from '../screens/admin/AdminCreateProductScreen';
import AdminEditProductScreen from '../screens/admin/AdminEditProductScreen';
import AdminUsersScreen from '../screens/admin/AdminUsersScreen';
import AdminDeliveryBoysScreen from '../screens/admin/AdminDeliveryBoysScreen';
import AdminAnalyticsScreen from '../screens/admin/AdminAnalyticsScreen';
import AdminFinanceScreen from '../screens/admin/AdminFinanceScreen';
import AdminRoutesScreen from '../screens/admin/AdminRoutesScreen';
import AdminRouteDetailScreen from '../screens/admin/AdminRouteDetailScreen';
import AdminRouteMapScreen from '../screens/admin/AdminRouteMapScreen';
import AdminRoutesPreviewScreen from '../screens/admin/AdminRoutesPreviewScreen';
import AdminRecentRoutesScreen from '../screens/admin/AdminRecentRoutesScreen';
import AdminSettingsScreen from '../screens/admin/AdminSettingsScreen';
import AdminProfileScreen from '../screens/admin/AdminProfileScreen';
import AdminPaymentsScreen from '../screens/admin/AdminPaymentsScreen';
import AdminOpsScreen from '../screens/admin/AdminOpsScreen';

const Stack = createStackNavigator();

export default function AdminNavigator() {
  return (
    <Stack.Navigator
      id="AdminStack"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
      />

      <Stack.Screen name="AdminOrders" component={AdminOrdersScreen} />
      <Stack.Screen name="AdminOrderDetail" component={AdminOrderDetailScreen} />

      <Stack.Screen name="AdminProducts" component={AdminProductsScreen} />
      <Stack.Screen name="AdminCreateProduct" component={AdminCreateProductScreen} />
      <Stack.Screen name="AdminEditProduct" component={AdminEditProductScreen} />

      <Stack.Screen name="AdminUsers" component={AdminUsersScreen} />
      <Stack.Screen name="AdminDeliveryBoys" component={AdminDeliveryBoysScreen} />
      <Stack.Screen name="AdminAnalytics" component={AdminAnalyticsScreen} />
      <Stack.Screen name="AdminFinance" component={AdminFinanceScreen} />

      {/* New screens */}
      <Stack.Screen name="AdminRoutes" component={AdminRoutesScreen} />
      <Stack.Screen name="AdminRouteDetail" component={AdminRouteDetailScreen} />
      <Stack.Screen name="AdminRouteMap" component={AdminRouteMapScreen} />
      <Stack.Screen name="AdminRoutesPreview" component={AdminRoutesPreviewScreen} />
      <Stack.Screen name="AdminRecentRoutes" component={AdminRecentRoutesScreen} />
      <Stack.Screen name="AdminSettings" component={AdminSettingsScreen} />
      <Stack.Screen name="AdminProfile" component={AdminProfileScreen} />
      <Stack.Screen name="AdminPayments" component={AdminPaymentsScreen} />
      <Stack.Screen name="AdminOps" component={AdminOpsScreen} />
    </Stack.Navigator>
  );
}

