import { useEffect, useState, useRef } from 'react';
import { BASE_URL } from '../api/baseApi';
import { logEvent } from '../utils/analytics';

interface ConnectivityStatus {
  isChecking: boolean;
  isConnected: boolean;
  error: string | null;
  retryCount: number;
}

const INITIAL_TIMEOUT = 8000; // 8s timeout — local network can be slow on first connect
const RETRY_INTERVAL = 45000; // 45s between automatic retries

/**
 * Hook to check backend connectivity on app startup
 * Tests the /health endpoint before loading main screens
 * Automatically retries in background if connection fails
 */
export const useConnectivityCheck = () => {
  const [status, setStatus] = useState<ConnectivityStatus>({
    isChecking: true,
    isConnected: false,
    error: null,
    retryCount: 0,
  });

  const retryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    const checkConnectivity = async (isBackgroundRetry = false) => {
      try {
        // BASE_URL ends with /api, so this hits /api/health
        const healthUrl = `${BASE_URL}/health`;
        console.log(
          isBackgroundRetry 
            ? '🔄 Background retry: Checking backend connectivity...' 
            : '🏥 Checking backend connectivity...', 
          healthUrl
        );
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), INITIAL_TIMEOUT);

        let response: Response;
        try {
          response = await fetch(healthUrl, {
            method: 'GET',
            signal: controller.signal,
            headers: {
              'Accept': 'application/json',
              'Cache-Control': 'no-cache',
              'ngrok-skip-browser-warning': 'true'
            }
          });
        } catch (fetchErr: any) {
          // If /api/health fails, try the root /health endpoint
          clearTimeout(timeoutId);
          const rootHealthUrl = BASE_URL.replace(/\/api$/, '') + '/health';
          const controller2 = new AbortController();
          const timeoutId2 = setTimeout(() => controller2.abort(), INITIAL_TIMEOUT);
          response = await fetch(rootHealthUrl, {
            method: 'GET',
            signal: controller2.signal,
            headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' }
          });
          clearTimeout(timeoutId2);
        }

        clearTimeout(timeoutId);

        if (cancelledRef.current) return;

        if (response.ok) {
          console.log('✅ Backend connectivity check passed');
          logEvent('connectivity_check_success', { url: healthUrl });
          
          // Stop background retries on successful connection
          if (retryIntervalRef.current) {
            clearInterval(retryIntervalRef.current);
            retryIntervalRef.current = null;
          }
          
          setStatus({
            isChecking: false,
            isConnected: true,
            error: null,
            retryCount: 0,
          });
        } else {
          console.error('❌ Backend health check failed:', response.status);
          logEvent('connectivity_check_failed', { 
            url: healthUrl, 
            status: response.status 
          });
          
          const contentType = response.headers.get('content-type') || '';
          let errorText = '';
          try {
            if (contentType.includes('text/html') || contentType.includes('text/plain')) {
              errorText = (await response.text()).slice(0, 2000);
            }
          } catch {}

          const isNgrokOffline = errorText.includes('ERR_NGROK_3200');

          setStatus(prev => ({
            isChecking: false,
            isConnected: false,
            error: isNgrokOffline
              ? 'Ngrok tunnel is offline. Start ngrok on your laptop and restart the app.'
              : `Server returned status ${response.status}`,
            retryCount: prev.retryCount + 1,
          }));
          
          // Start background retry if not already running
          if (!retryIntervalRef.current && !isBackgroundRetry) {
            startBackgroundRetry();
          }
        }
      } catch (error: any) {
        if (cancelledRef.current) return;

        console.error('❌ Backend connectivity check failed:', error.message);
        logEvent('connectivity_check_error', { 
          url: `${BASE_URL}/health`, 
          error: error.message 
        });

        let errorMessage = `Cannot connect to server (${error.message})`;
        
        if (error.name === 'AbortError') {
          errorMessage = 'Connection timeout - server is not responding';
        } else if (error.message?.includes('Network request failed')) {
          errorMessage = 'Network error - please check your WiFi connection';
        }

        setStatus(prev => ({
          isChecking: false,
          isConnected: false,
          error: errorMessage,
          retryCount: prev.retryCount + 1,
        }));
        
        // Start background retry if not already running
        if (!retryIntervalRef.current && !isBackgroundRetry) {
          startBackgroundRetry();
        }
      }
    };

    const startBackgroundRetry = () => {
      console.log(`🔄 Starting background retry (every ${RETRY_INTERVAL / 1000}s)`);
      retryIntervalRef.current = setInterval(() => {
        checkConnectivity(true);
      }, RETRY_INTERVAL);
    };

    checkConnectivity();

    return () => {
      cancelledRef.current = true;
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
        retryIntervalRef.current = null;
      }
    };
  }, []);

  const retry = () => {
    // Manual retry - don't set isChecking to true to avoid blocking UI
    console.log('🔄 Manual retry requested');
    
    // Re-run the connectivity check in background
    setTimeout(async () => {
      try {
        const healthUrl = `${BASE_URL}/health`;
        console.log('🏥 Retrying backend connectivity check...', healthUrl);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), INITIAL_TIMEOUT);

        const response = await fetch(healthUrl, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache',
            'ngrok-skip-browser-warning': 'true'
          }
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          console.log('✅ Backend connectivity check passed on retry');
          logEvent('connectivity_retry_success', { url: healthUrl });
          
          // Stop background retries on successful connection
          if (retryIntervalRef.current) {
            clearInterval(retryIntervalRef.current);
            retryIntervalRef.current = null;
          }
          
          setStatus({
            isChecking: false,
            isConnected: true,
            error: null,
            retryCount: 0,
          });
        } else {
          console.error('❌ Backend health check failed on retry:', response.status);
          logEvent('connectivity_retry_failed', { 
            url: healthUrl, 
            status: response.status 
          });

          const contentType = response.headers.get('content-type') || '';
          let errorText = '';
          try {
            if (contentType.includes('text/html') || contentType.includes('text/plain')) {
              errorText = (await response.text()).slice(0, 2000);
            }
          } catch {}
          const isNgrokOffline = errorText.includes('ERR_NGROK_3200');

          setStatus(prev => ({
            isChecking: false,
            isConnected: false,
            error: isNgrokOffline
              ? 'Ngrok tunnel is offline. Start ngrok on your laptop and restart the app.'
              : `Server returned status ${response.status}`,
            retryCount: prev.retryCount + 1,
          }));
        }
      } catch (error: any) {
        console.error('❌ Backend connectivity retry failed:', error.message);
        logEvent('connectivity_retry_error', { 
          url: `${BASE_URL}/health`, 
          error: error.message 
        });

        let errorMessage = `Cannot connect to server (${error.message})`;
        
        if (error.name === 'AbortError') {
          errorMessage = 'Connection timeout - server is not responding';
        } else if (error.message?.includes('Network request failed')) {
          errorMessage = 'Network error - please check your WiFi connection';
        }

        setStatus(prev => ({
          isChecking: false,
          isConnected: false,
          error: errorMessage,
          retryCount: prev.retryCount + 1,
        }));
      }
    }, 100);
  };

  return { ...status, retry };
};
