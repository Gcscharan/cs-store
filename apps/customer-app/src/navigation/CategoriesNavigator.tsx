import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import type { CategoriesStackParamList } from './types';
import CategoriesScreen from '../screens/products/CategoriesScreen';
import ProductDetailScreen from '../screens/products/ProductDetailScreen';
import AllReviewsScreen from '../screens/reviews/AllReviewsScreen';
import WriteReviewScreen from '../screens/reviews/WriteReviewScreen';

const Stack = createStackNavigator<CategoriesStackParamList>();

export default function CategoriesNavigator() {
  return (
    <Stack.Navigator id="CategoriesStack" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Categories" component={CategoriesScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="AllReviews" component={AllReviewsScreen} />
      <Stack.Screen name="WriteReview" component={WriteReviewScreen} />
    </Stack.Navigator>
  );
}
