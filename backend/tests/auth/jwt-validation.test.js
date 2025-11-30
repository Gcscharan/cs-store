const { describe, test, beforeEach, afterEach, jest } = require('@jest/globals');
const { spawn } = require('child_process');
const path = require('path');

describe('JWT Secret Validation', () => {
  let originalEnv;
  
  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };
    // Clear console methods to capture output
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(process, 'exit').mockImplementation(() => {});
  });
  
  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  test('should warn in development with short JWT_SECRET', async () => {
    // Set development mode with short secrets
    process.env.NODE_ENV = 'development';
    process.env.JWT_SECRET = 'short';
    process.env.JWT_REFRESH_SECRET = 'also_short';
    
    // Import the app module (which will run validation)
    try {
      // Dynamic import to trigger validation
      const appPath = path.join(__dirname, '../../src/app.ts');
      await import(appPath);
    } catch (error) {
      // Expected - module might fail for other reasons
    }
    
    // Should have warned about short secrets
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[DEV WARNING] JWT_SECRET must be at least 32 characters long')
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[DEV WARNING] JWT_REFRESH_SECRET must be at least 32 characters long')
    );
    
    // Should NOT have exited in development
    expect(process.exit).not.toHaveBeenCalled();
  });

  test('should exit in production with short JWT_SECRET', async () => {
    // Set production mode with short secrets
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'short';
    process.env.JWT_REFRESH_SECRET = 'also_short';
    
    // Import the app module
    try {
      const appPath = path.join(__dirname, '../../src/app.ts');
      await import(appPath);
    } catch (error) {
      // Expected - module might fail for other reasons
    }
    
    // Should have logged fatal error
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[FATAL] JWT_SECRET must be at least 32 characters long')
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[FATAL] JWT_REFRESH_SECRET must be at least 32 characters long')
    );
    
    // Should have exited in production
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  test('should pass with valid secrets in any environment', async () => {
    // Set valid secrets
    process.env.JWT_SECRET = 'this_is_a_32_character_minimum_secret_for_security';
    process.env.JWT_REFRESH_SECRET = 'this_is_also_32_chars_minimum_for_refresh_secret';
    process.env.NODE_ENV = 'production';
    
    // Import the app module
    try {
      const appPath = path.join(__dirname, '../../src/app.ts');
      await import(appPath);
    } catch (error) {
      // Expected - module might fail for other reasons
    }
    
    // Should NOT have warned or exited
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
    expect(process.exit).not.toHaveBeenCalled();
  });

  test('should handle missing secrets', async () => {
    // Remove secrets
    delete process.env.JWT_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    process.env.NODE_ENV = 'production';
    
    // Import the app module
    try {
      const appPath = path.join(__dirname, '../../src/app.ts');
      await import(appPath);
    } catch (error) {
      // Expected - module might fail for other reasons
    }
    
    // Should have logged fatal error about missing secrets
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[FATAL] JWT_SECRET must be at least 32 characters long. Current length: 0')
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[FATAL] JWT_REFRESH_SECRET must be at least 32 characters long. Current length: 0')
    );
    
    // Should have exited
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
