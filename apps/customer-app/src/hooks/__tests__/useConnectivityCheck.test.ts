import { renderHook, waitFor } from '@testing-library/react-native';
import { useConnectivityCheck } from '../useConnectivityCheck';
import { BASE_URL } from '../../api/baseApi';

// Mock fetch
global.fetch = jest.fn();

// Mock analytics
jest.mock('../../utils/analytics', () => ({
  logEvent: jest.fn(),
}));

describe('useConnectivityCheck', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  it('should start with checking state', () => {
    (global.fetch as jest.Mock).mockImplementation(() => 
      new Promise(() => {}) // Never resolves
    );

    const { result } = renderHook(() => useConnectivityCheck());

    expect(result.current.isChecking).toBe(true);
    expect(result.current.isConnected).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.retryCount).toBe(0);
  });

  it('should set connected state when health check succeeds', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
    });

    const { result } = renderHook(() => useConnectivityCheck());

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.error).toBeNull();
    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE_URL}/health`,
      expect.objectContaining({
        method: 'GET',
      })
    );
  });

  it('should set error state when health check fails with non-ok status', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 503,
    });

    const { result } = renderHook(() => useConnectivityCheck());

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.error).toBe('Server returned status 503');
  });

  it('should set error state when network request fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('Network request failed')
    );

    const { result } = renderHook(() => useConnectivityCheck());

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.error).toBe('Network error - please check your WiFi connection');
  });

  it('should set error state when request times out', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    
    (global.fetch as jest.Mock).mockRejectedValueOnce(abortError);

    const { result } = renderHook(() => useConnectivityCheck());

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.error).toBe('Connection timeout - server is not responding');
  });

  it('should retry connectivity check when retry is called', async () => {
    // First call fails
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('Network request failed')
    );

    const { result } = renderHook(() => useConnectivityCheck());

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.error).toBeTruthy();
    expect(result.current.retryCount).toBe(1);

    // Second call succeeds
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
    });

    result.current.retry();

    // Manual retry is non-blocking, so isChecking stays false
    expect(result.current.isChecking).toBe(false);

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    }, { timeout: 3000 });

    expect(result.current.error).toBeNull();
    expect(result.current.retryCount).toBe(0);
  });

  it('should automatically retry in background when health check fails', async () => {
    jest.useFakeTimers();

    // First call fails
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('Network request failed')
    );

    const { result } = renderHook(() => useConnectivityCheck());

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.error).toBeTruthy();
    expect(result.current.retryCount).toBe(1);

    // Second call (background retry) succeeds
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
    });

    // Fast-forward time to trigger background retry (45 seconds)
    jest.advanceTimersByTime(45000);

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.retryCount).toBe(0);

    jest.useRealTimers();
  });

  it('should stop background retries after successful connection', async () => {
    jest.useFakeTimers();

    // First call fails
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('Network request failed')
    );

    const { result } = renderHook(() => useConnectivityCheck());

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });

    expect(result.current.isConnected).toBe(false);

    // Second call (background retry) succeeds
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
    });

    // Fast-forward time to trigger background retry
    jest.advanceTimersByTime(45000);

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // Clear mock to verify no more calls
    (global.fetch as jest.Mock).mockClear();

    // Fast-forward time again - should NOT trigger another retry
    jest.advanceTimersByTime(45000);

    // Wait a bit to ensure no fetch was called
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(global.fetch).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('should expose retryCount for debugging', async () => {
    // First call fails
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('Network request failed')
    );

    const { result } = renderHook(() => useConnectivityCheck());

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });

    expect(result.current.retryCount).toBe(1);

    // Second call fails
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('Network request failed')
    );

    result.current.retry();

    await waitFor(() => {
      expect(result.current.retryCount).toBe(2);
    }, { timeout: 3000 });
  });
});
