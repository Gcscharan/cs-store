import { NavigatorScreenParams } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

// Auth Stack
export type AuthStackParamList = {
  Login: undefined;
  OTP: { email?: string; phone?: string; isSignup?: boolean; name?: string; signupEmail?: string };
  Signup: { phone?: string };
  Onboarding: { onboardingToken?: string; email?: string; name?: string; avatar?: string };
};

// Main Tab Navigator
export type MainTabParamList = {
  Home: undefined;
  Categories: undefined;
  Cart: undefined;
  Orders: undefined;
  Account: undefined;
};

// Home Stack (nested in Home Tab)
export type HomeStackParamList = {
  Home: undefined;
  Search: { initialQuery?: string };
  ProductDetail: { productId: string };
  ProductsList: { category?: string };
  // ✅ Reviews screens added here
  AllReviews: { productId: string; productName: string };
  WriteReview: {
    productId: string;
    productName: string;
    existingReview?: {
      _id: string;
      rating: number;
      comment: string;
      images?: string[];
    };
  };
};

// Categories Stack (nested in Categories Tab)
export type CategoriesStackParamList = {
  Categories: undefined;
  ProductDetail: { productId: string };
  AllReviews: { productId: string; productName: string };
  WriteReview: {
    productId: string;
    productName: string;
    existingReview?: {
      _id: string;
      rating: number;
      comment: string;
      images?: string[];
    };
  };
};

// Cart Stack
export type CartStackParamList = {
  Cart: undefined;
  Checkout: undefined;
  OrderSuccess: { orderId: string };
  Addresses: undefined;
  AddAddress: { addressId?: string };
};

// Orders Stack
export type OrdersStackParamList = {
  Orders: undefined;
  OrderDetail: { orderId: string };
  OrderTracking: { orderId: string };
};

// Profile Stack
export type ProfileStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  Addresses: undefined;
  AddAddress: { addressId?: string };
  Notifications: undefined;
  Settings: undefined;
  ReferEarn: undefined;
};

// Root Stack (covers everything)
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  // Modal screens that appear over tabs
  ProductDetail: { productId: string };
  OrderTracking: { orderId: string };
  OrderSuccess: { orderId: string };
  OrderDetail: { orderId: string };
  Search: { initialQuery?: string };
  WriteReview: {
    productId: string;
    productName: string;
    existingReview?: {
      _id: string;
      rating: number;
      comment: string;
      images?: string[];
    };
  };
  AllReviews: { productId: string; productName: string };
};

// Navigation prop types
export type AuthNavigationProp = StackNavigationProp<AuthStackParamList>;
export type MainTabNavigationProp = BottomTabNavigationProp<MainTabParamList>;
export type HomeNavigationProp = StackNavigationProp<HomeStackParamList>;
export type CategoriesNavigationProp = StackNavigationProp<CategoriesStackParamList>;
export type CartNavigationProp = StackNavigationProp<CartStackParamList>;
export type OrdersNavigationProp = StackNavigationProp<OrdersStackParamList>;
export type ProfileNavigationProp = StackNavigationProp<ProfileStackParamList>;
export type RootNavigationProp = StackNavigationProp<RootStackParamList>;

// Route prop types
export type LoginScreenRouteProp = {
  key: string;
  name: 'Login';
  params: undefined;
};

export type OTPScreenRouteProp = {
  key: string;
  name: 'OTP';
  params: { email?: string; phone?: string; isSignup?: boolean; name?: string; signupEmail?: string };
};

export type ProductDetailRouteProp = {
  key: string;
  name: 'ProductDetail';
  params: { productId: string };
};

export type OrderDetailRouteProp = {
  key: string;
  name: 'OrderDetail';
  params: { orderId: string };
};

export type OrderTrackingRouteProp = {
  key: string;
  name: 'OrderTracking';
  params: { orderId: string };
};

export type AllReviewsRouteProp = {
  key: string;
  name: 'AllReviews';
  params: { productId: string; productName: string };
};

export type WriteReviewRouteProp = {
  key: string;
  name: 'WriteReview';
  params: {
    productId: string;
    productName: string;
    existingReview?: {
      _id: string;
      rating: number;
      comment: string;
      images?: string[];
    };
  };
};