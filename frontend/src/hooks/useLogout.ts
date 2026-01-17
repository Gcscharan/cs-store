import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logout, resetAppState } from '../store/slices/authSlice';
import { api } from '../store/api';
import { auditLocalStorage, checkForContamination } from '../utils/storageDebug';
import { toApiUrl } from '../config/runtime';

/**
 * Enhanced logout hook that performs complete state cleanup
 * - Clears auth state
 * - Resets entire Redux state (cart, UI, cached API data)
 * - Navigates to home page
 */
export const useLogout = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const performLogout = async () => {
    console.log('🚪 LOGOUT: Starting AGGRESSIVE logout process...');
    
    // Set logout flag to prevent AuthRouter from interfering
    if (typeof window !== 'undefined') {
      localStorage.setItem('isLoggingOut', 'true');
    }
    
    // Step 0: Debug audit BEFORE cleanup
    console.log('🔍 PRE-LOGOUT AUDIT:');
    auditLocalStorage();
    
    // Step 0.5: CRITICAL - Call SECURE backend logout FIRST to revoke server-side tokens
    try {
      console.log('🔐 SECURE LOGOUT: Calling protected backend logout endpoint...');
      
      // Get tokens from localStorage to send to backend
      const authData = localStorage.getItem('auth');
      const accessToken = localStorage.getItem('accessToken');
      let refreshToken = null;
      
      if (authData) {
        try {
          const parsed = JSON.parse(authData);
          refreshToken = parsed.tokens?.refreshToken;
        } catch (e) {
          console.warn('Could not parse auth data for refresh token');
        }
      }
      
      if (!accessToken) {
        console.warn('⚠️ No access token found, cannot call secure logout endpoint');
      } else {
        // Call PROTECTED backend logout endpoint
        const response = await fetch(toApiUrl('/auth/logout'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}` // REQUIRED for protected endpoint
          },
          body: JSON.stringify({
            refreshToken: refreshToken
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('✅ SECURE LOGOUT: Backend session revoked successfully', {
            tokensRevoked: result.tokensRevoked,
            message: result.message
          });
        } else if (response.status === 401) {
          console.warn('⚠️ SECURE LOGOUT: Token already invalid/expired, continuing cleanup');
        } else {
          console.warn('⚠️ SECURE LOGOUT: Backend logout failed, continuing with client cleanup');
        }
      }
    } catch (error) {
      console.warn('⚠️ SECURE LOGOUT: Backend error (continuing with client cleanup):', error);
    }
    
    // Step 1: AGGRESSIVE localStorage cleanup - Remove ALL possible auth-related keys
    console.log('🔥 AGGRESSIVE: Clearing all localStorage keys...');
    const keysToRemove = [
      'auth',              // Main auth object
      'accessToken',       // JWT access token
      'refreshToken',      // JWT refresh token  
      'token',             // Generic token key
      'user',              // User data
      'userId',            // User ID
      'user_id',           // Alternative user ID format
      'currentUser',       // Current user data
      'userProfile',       // User profile data
      'addresses',         // Cached addresses
      'saved_addresses',   // Alternative address format
      'cart',              // Cart data
      'cartData',          // Alternative cart format
      'userCart',          // User-specific cart
      'autofillAddress',   // Location autofill data
      'selectedAddress',   // Currently selected address
      'defaultAddress',    // Default address data
      'isLoggingOut',      // Logout flag
    ];
    
    keysToRemove.forEach(key => {
      if (localStorage.getItem(key)) {
        console.log(`🔥 REMOVING localStorage key: ${key}`);
        localStorage.removeItem(key);
      }
    });
    
    // Step 2: Clear sessionStorage as well (in case anything is stored there)
    console.log('🔥 AGGRESSIVE: Clearing sessionStorage...');
    try {
      sessionStorage.clear();
    } catch (e) {
      console.warn('Could not clear sessionStorage:', e);
    }
    
    // Step 3: Logout from auth state (this also clears some localStorage)
    dispatch(logout());
    
    // Step 4: Reset entire app state (cart, UI, etc.)
    dispatch(resetAppState());
    
    // Step 5: Clear RTK Query cache (user data, cart, addresses, etc.)
    console.log('🔥 AGGRESSIVE: Clearing RTK Query cache...');
    dispatch(api.util.resetApiState());
    
    // Verify RTK Query cache was cleared
    setTimeout(() => {
      const state = (dispatch as any).getState?.() || {};
      const apiState = state.api;
      console.log('🔍 RTK Query state after reset:', {
        queries: Object.keys(apiState?.queries || {}),
        mutations: Object.keys(apiState?.mutations || {}),
        totalQueries: Object.keys(apiState?.queries || {}).length
      });
    }, 10);
    
    // Step 6: Force clear any remaining auth-related localStorage after Redux actions
    setTimeout(() => {
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log('🔥 DOUBLE-CHECK: Re-cleared localStorage keys');
    }, 100);
    
    // Step 7: Final contamination check
    setTimeout(() => {
      console.log('🔍 POST-LOGOUT CONTAMINATION CHECK:');
      const contaminated = checkForContamination();
      if (contaminated) {
        console.error('🚨 CRITICAL: Contamination still detected after logout!');
      } else {
        console.log('✅ Clean state confirmed');
      }
    }, 150);
    
    // Step 8: GUARANTEED, IMMEDIATE redirect to break re-authentication loop
    console.log('🚪 LOGOUT: Executing GUARANTEED redirect to break auth loop...');
    
    // CRITICAL: Use window.location.href for immediate, non-conditional redirect
    // This bypasses React Router and any interceptors that might prevent navigation
    setTimeout(() => {
      console.log('🚪 LOGOUT: FORCE REDIRECT - Breaking any auth loops');
      window.location.href = '/';
    }, 100); // Small delay to ensure cleanup completes
    
    // Backup: Also use React Router navigate as secondary measure
    navigate('/', { replace: true });
    
    console.log('✅ AGGRESSIVE LOGOUT: Complete state cleanup finished');
  };

  return performLogout;
};

/**
 * Hook for clean user switching (for new login)
 * - Resets state but doesn't navigate (useful for OAuth callbacks)
 */
export const useCleanUserSwitch = () => {
  const dispatch = useDispatch();

  const cleanUserSwitch = () => {
    console.log('🔄 USER SWITCH: AGGRESSIVE cleaning for new user...');
    
    // Step 0: Audit current state
    console.log('🔍 PRE-SWITCH AUDIT:');
    auditLocalStorage();
    
    // Step 1: AGGRESSIVE localStorage cleanup BEFORE new user login
    console.log('🔥 PRE-LOGIN: Clearing all localStorage keys...');
    const keysToRemove = [
      'auth', 'accessToken', 'refreshToken', 'token', 
      'user', 'userId', 'user_id', 'currentUser', 'userProfile',
      'addresses', 'saved_addresses', 'cart', 'cartData', 'userCart',
      'autofillAddress', 'selectedAddress', 'defaultAddress'
    ];
    
    keysToRemove.forEach(key => {
      if (localStorage.getItem(key)) {
        console.log(`🔥 PRE-LOGIN REMOVING: ${key}`);
        localStorage.removeItem(key);
      }
    });
    
    // Step 2: Clear sessionStorage
    try {
      sessionStorage.clear();
    } catch (e) {
      console.warn('Could not clear sessionStorage:', e);
    }
    
    // Step 3: Reset entire app state to prevent data contamination
    dispatch(resetAppState());
    
    // Step 4: Clear RTK Query cache to prevent previous user's cached data
    dispatch(api.util.resetApiState());
    
    console.log('✅ USER SWITCH: AGGRESSIVE cleanup completed for new user');
  };

  return cleanUserSwitch;
};
