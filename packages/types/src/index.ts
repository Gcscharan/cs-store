// Core shared types for VyaparSetu
// These are used by web, mobile, and backend

export interface User {
  id: string;
  _id?: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  role: 'customer' | 'admin' | 'delivery';
  addresses?: Address[];
}

export interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  mrp: number;
  category: string;
  images: string[];
  stock: number;
  variants?: ProductVariant[];
  unit?: string;
  slug?: string;
}

export interface ProductVariant {
  name: string;
  price: number;
  stock: number;
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  unit?: string;
}

export interface Order {
  orderId: string;
  _id: string;
  userId: string;
  items: CartItem[];
  totalAmount: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  deliveryAddress: Address;
  createdAt: string;
  deliveryBoy?: DeliveryBoy;
  estimatedDelivery?: string;
  tracking?: OrderTracking;
}

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'PACKED'
  | 'ASSIGNED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'ARRIVED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'FAILED';

export type PaymentStatus =
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED';

export interface Address {
  _id?: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  lat?: number;
  lng?: number;
  isDefault?: boolean;
  label?: string;
}

export interface DeliveryBoy {
  id: string;
  _id?: string;
  name: string;
  phone: string;
  vehicleType: string;
  status: 'online' | 'offline' | 'busy';
  currentLocation?: { lat: number; lng: number };
  avatar?: string;
}

export interface OrderTracking {
  currentStatus: OrderStatus;
  timeline: TrackingEvent[];
  liveLocation?: { lat: number; lng: number };
  eta?: string;
}

export interface TrackingEvent {
  status: OrderStatus;
  timestamp: string;
  description: string;
  location?: string;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  image?: string;
  parentId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  products?: T[];
  orders?: T[];
  items?: T[];
  page: number;
  totalPages: number;
  total: number;
  hasMore: boolean;
}
