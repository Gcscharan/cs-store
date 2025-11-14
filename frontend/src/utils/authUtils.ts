/**
 * Authentication and State Management Utilities
 * 
 * These utilities ensure complete state cleanup and prevent user data contamination
 * when users log out or when new users log in.
 */

import { store } from '../store';
import { resetAppState } from '../store/slices/authSlice';
import { api } from '../store/api';

/**
 * Performs complete application state reset
 * - Clears Redux state (except theme preference)
 * - Clears RTK Query cache (user data, cart, addresses, etc.)
 * - Clears localStorage auth data
 * 
 * Use this when:
 * - User logs out
 * - New user logs in (to prevent data contamination)
 * - Session expires
 */
export const resetApplicationState = () => {
  console.log('🧹 CLEANING APPLICATION STATE...');
  
  // Reset Redux state (preserves theme)
  store.dispatch(resetAppState());
  
  // Clear RTK Query cache to remove cached user data
  store.dispatch(api.util.resetApiState());
  
  console.log('✅ APPLICATION STATE CLEANED');
};

/**
 * Enhanced login state setup for new users
 * Should be called immediately after successful OAuth/login
 * to ensure no lingering data from previous sessions
 */
export const prepareCleanLoginState = () => {
  console.log('🔄 PREPARING CLEAN STATE FOR NEW LOGIN...');
  
  // Clear any existing state before login
  resetApplicationState();
  
  console.log('✅ CLEAN STATE READY FOR NEW USER');
};

/**
 * Check if current user data might be contaminated
 * (This is a debugging utility - not for production use)
 */
export const debugStateContamination = () => {
  const state = store.getState();
  
  console.log('🔍 STATE CONTAMINATION DEBUG:', {
    cartItems: state.cart.items.length,
    cartTotal: state.cart.total,
    apiCacheKeys: Object.keys(state.api.queries || {}),
    hasUserInAuth: !!state.auth.user,
    userId: state.auth.user?.id,
  });
};
