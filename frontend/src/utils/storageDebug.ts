/**
 * CRITICAL DEBUGGING UTILITIES for localStorage contamination
 * 
 * These functions help identify and resolve authentication token persistence issues
 * that cause users to see each other's data.
 */

/**
 * Audit all localStorage keys that might contain user data
 */
export const auditLocalStorage = () => {
  console.log('🔍 === LOCALSTORAGE AUDIT START ===');
  
  const suspiciousKeys = [
    'auth', 'accessToken', 'refreshToken', 'token', 
    'user', 'userId', 'user_id', 'currentUser', 'userProfile',
    'addresses', 'saved_addresses', 'cart', 'cartData', 'userCart',
    'autofillAddress', 'selectedAddress', 'defaultAddress'
  ];
  
  const foundData: { [key: string]: any } = {};
  
  suspiciousKeys.forEach(key => {
    const value = localStorage.getItem(key);
    if (value) {
      try {
        foundData[key] = JSON.parse(value);
        console.log(`🔍 FOUND ${key}:`, foundData[key]);
      } catch (e) {
        foundData[key] = value;
        console.log(`🔍 FOUND ${key} (string):`, value);
      }
    }
  });
  
  // Check for any keys containing 'user', 'auth', or 'token'
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('user') || key.includes('auth') || key.includes('token'))) {
      if (!suspiciousKeys.includes(key)) {
        const value = localStorage.getItem(key);
        console.log(`🔍 SUSPICIOUS KEY FOUND: ${key}:`, value);
        foundData[key] = value;
      }
    }
  }
  
  console.log('🔍 === LOCALSTORAGE AUDIT END ===');
  return foundData;
};

/**
 * Force clear ALL localStorage data (nuclear option)
 */
export const nuclearClearStorage = () => {
  console.log('💥 NUCLEAR CLEAR: Removing ALL localStorage data...');
  
  const allKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) allKeys.push(key);
  }
  
  allKeys.forEach(key => {
    console.log(`💥 NUCLEAR: Removing ${key}`);
    localStorage.removeItem(key);
  });
  
  // Also clear sessionStorage
  sessionStorage.clear();
  
  console.log('💥 NUCLEAR CLEAR: Complete');
};

/**
 * Check if user tokens are actually being sent in API requests
 */
export const debugAPIHeaders = () => {
  console.log('🌐 === API HEADERS DEBUG ===');
  
  const authData = localStorage.getItem('auth');
  if (authData) {
    try {
      const parsed = JSON.parse(authData);
      console.log('🌐 Auth data found in localStorage:', {
        hasUser: !!parsed.user,
        userId: parsed.user?.id,
        hasAccessToken: !!parsed.tokens?.accessToken,
        tokenPreview: parsed.tokens?.accessToken?.substring(0, 20) + '...',
        isAuthenticated: parsed.isAuthenticated
      });
    } catch (e) {
      console.log('🌐 Invalid auth data format');
    }
  } else {
    console.log('🌐 No auth data in localStorage');
  }
  
  // Check individual token keys
  const accessToken = localStorage.getItem('accessToken');
  if (accessToken) {
    console.log('🌐 Separate accessToken found:', accessToken.substring(0, 20) + '...');
  }
  
  console.log('🌐 === API HEADERS DEBUG END ===');
};

/**
 * Real-time localStorage monitor (for development)
 */
export const startStorageMonitoring = () => {
  console.log('👁️ Starting localStorage monitoring...');
  
  const originalSetItem = localStorage.setItem;
  const originalRemoveItem = localStorage.removeItem;
  
  localStorage.setItem = function(key, value) {
    console.log(`👁️ localStorage.setItem: ${key} =`, value);
    return originalSetItem.call(this, key, value);
  };
  
  localStorage.removeItem = function(key) {
    console.log(`👁️ localStorage.removeItem: ${key}`);
    return originalRemoveItem.call(this, key);
  };
  
  console.log('👁️ localStorage monitoring active');
};

/**
 * Quick contamination check - run this when new user logs in
 */
export const checkForContamination = () => {
  console.log('🚨 === CONTAMINATION CHECK ===');
  
  const authData = localStorage.getItem('auth');
  if (authData) {
    console.log('🚨 WARNING: Auth data exists when it should be clean!', authData);
    return true;
  }
  
  const suspiciousKeys = ['accessToken', 'user', 'userId', 'cart', 'addresses'];
  let contaminated = false;
  
  suspiciousKeys.forEach(key => {
    if (localStorage.getItem(key)) {
      console.log(`🚨 CONTAMINATION: ${key} exists when it should be clean!`);
      contaminated = true;
    }
  });
  
  if (!contaminated) {
    console.log('✅ No contamination detected');
  }
  
  console.log('🚨 === CONTAMINATION CHECK END ===');
  return contaminated;
};

// Expose to window for easy debugging in browser console
if (typeof window !== 'undefined') {
  (window as any).storageDebug = {
    audit: auditLocalStorage,
    nuclear: nuclearClearStorage,
    headers: debugAPIHeaders,
    monitor: startStorageMonitoring,
    contamination: checkForContamination
  };
  
  console.log('🔧 Storage debug utilities available on window.storageDebug');
}
