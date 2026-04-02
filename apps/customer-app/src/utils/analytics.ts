import { getApps } from '@react-native-firebase/app';
import { getAnalytics, logEvent as fbLogEvent } from '@react-native-firebase/analytics';

/**
 * Logs a custom analytics event using V22 Modular Firebase API.
 * @param {string} name - The name of the event.
 * @param {object} [params={}] - An object of key-value pairs to send with the event.
 */
export const logEvent = async (name: string, params: object = {}) => {
  try {
    if (getApps().length === 0) return;
    
    const analyticsInstance = getAnalytics();
    await fbLogEvent(analyticsInstance, name, params);
  } catch (error) {
    // Silently fail if analytics module is broken or unavailable
  }
};
