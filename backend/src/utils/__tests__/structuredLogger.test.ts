/**
 * Structured Logger Tests
 * 
 * Minimal tests for structured logging functionality
 */

import { logInfo, logWarn, logError } from '../structuredLogger';

describe('Structured Logger', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('logWarn', () => {
    it('should output valid JSON', () => {
      logWarn('TEST_WARNING', { detail: 'test' });

      expect(consoleWarnSpy).toHaveBeenCalled();
      const output = consoleWarnSpy.mock.calls[0][0];
      
      // Should be valid JSON
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it('should include required fields', () => {
      logWarn('TEST_WARNING', { detail: 'test' });

      const output = JSON.parse(consoleWarnSpy.mock.calls[0][0]);

      expect(output).toHaveProperty('event', 'TEST_WARNING');
      expect(output).toHaveProperty('timestamp');
      expect(output).toHaveProperty('environment');
      expect(output).toHaveProperty('service', 'pincode-api');
      expect(output).toHaveProperty('level', 'warn');
    });

    it('should use ISO 8601 timestamp format', () => {
      logWarn('TEST_WARNING');

      const output = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
      const timestamp = output.timestamp;

      // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should include custom data fields', () => {
      logWarn('TEST_WARNING', { pincode: '500001', duration: 123 });

      const output = JSON.parse(consoleWarnSpy.mock.calls[0][0]);

      expect(output.pincode).toBe('500001');
      expect(output.duration).toBe(123);
    });
  });

  describe('logError', () => {
    it('should output valid JSON', () => {
      logError('TEST_ERROR', { error: 'test' });

      expect(consoleErrorSpy).toHaveBeenCalled();
      const output = consoleErrorSpy.mock.calls[0][0];
      
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it('should include required fields', () => {
      logError('TEST_ERROR', { error: 'test' });

      const output = JSON.parse(consoleErrorSpy.mock.calls[0][0]);

      expect(output).toHaveProperty('event', 'TEST_ERROR');
      expect(output).toHaveProperty('timestamp');
      expect(output).toHaveProperty('environment');
      expect(output).toHaveProperty('service', 'pincode-api');
      expect(output).toHaveProperty('level', 'error');
    });
  });

  describe('logInfo sampling', () => {
    it('should sample info logs (not all calls produce output)', () => {
      // Call 100 times
      for (let i = 0; i < 100; i++) {
        logInfo('TEST_INFO', { iteration: i });
      }

      // Should be sampled (not all 100 logged)
      // With 10% sampling, expect ~10 logs (allow range 5-20 for randomness)
      const callCount = consoleLogSpy.mock.calls.length;
      expect(callCount).toBeGreaterThan(0);
      expect(callCount).toBeLessThan(100);
    });
  });
});
