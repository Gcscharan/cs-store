/**
 * Feature Flags — Safe Rollout System
 * 
 * Defaults are baked in. Server overrides fetched at boot.
 * Allows instant kill-switches without redeploy.
 * 
 * Usage:
 *   if (featureFlags.get('socketEnabled')) { connectSocket(); }
 */

import { storage } from '../utils/storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001/api';

export type FeatureFlagKey =
  | 'socketEnabled'
  | 'paymentRecovery'
  | 'realtimeTracking'
  | 'offlineQueue'
  | 'kycEnabled'
  | 'upiVerificationRequired'
  | 'sentryEnabled';

// ── Hardcoded defaults (safe baseline) ──
const DEFAULTS: Record<FeatureFlagKey, boolean> = {
  socketEnabled: true,
  paymentRecovery: true,
  realtimeTracking: true,
  offlineQueue: true,
  kycEnabled: true,
  upiVerificationRequired: true,
  sentryEnabled: true,
};

const CACHE_KEY = '@vyaparsetu_feature_flags';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

class FeatureFlags {
  private flags: Record<FeatureFlagKey, boolean> = { ...DEFAULTS };
  private lastFetched = 0;
  private fetching = false;

  /**
   * Get a flag value. Returns default if server hasn't responded yet.
   */
  get(key: FeatureFlagKey): boolean {
    return this.flags[key] ?? DEFAULTS[key] ?? false;
  }

  /**
   * Fetch flags from server. Falls back to cache, then defaults.
   */
  async refresh(): Promise<void> {
    if (this.fetching) return;
    if (Date.now() - this.lastFetched < CACHE_TTL_MS) return;

    this.fetching = true;
    try {
      const token = await storage.getItem('accessToken');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${API_URL}/config/feature-flags`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.flags && typeof data.flags === 'object') {
          // Only accept known keys
          for (const key of Object.keys(DEFAULTS) as FeatureFlagKey[]) {
            if (typeof data.flags[key] === 'boolean') {
              this.flags[key] = data.flags[key];
            }
          }
          this.lastFetched = Date.now();
          // Persist to cache
          await storage.setItem(CACHE_KEY, JSON.stringify(this.flags));
        }
      }
    } catch {
      // Network error — load from cache
      await this.loadFromCache();
    } finally {
      this.fetching = false;
    }
  }

  /**
   * Load cached flags from AsyncStorage.
   */
  private async loadFromCache(): Promise<void> {
    try {
      const cached = await storage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        for (const key of Object.keys(DEFAULTS) as FeatureFlagKey[]) {
          if (typeof parsed[key] === 'boolean') {
            this.flags[key] = parsed[key];
          }
        }
      }
    } catch {
      // Cache read failed — use defaults
    }
  }

  /**
   * Initialize: load cache then fetch fresh.
   */
  async init(): Promise<void> {
    await this.loadFromCache();
    await this.refresh();
  }
}

// Singleton
export const featureFlags = new FeatureFlags();
