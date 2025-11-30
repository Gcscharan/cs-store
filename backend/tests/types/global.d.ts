// Global type declarations for test helpers
declare global {
  var createTestUser: (overrides?: any) => Promise<any>;
  var createTestProduct: (overrides?: any) => Promise<any>;
  var createTestOrder: (userId: any, overrides?: any) => Promise<any>;
  var createTestOTP: (phone: any, type?: string, overrides?: any) => Promise<any>;
  var getAuthToken: (user: any) => Promise<string>;
  var getRefreshToken: (user: any) => Promise<string>;
}

export {};
