/**
 * Service Registry for Dependency Injection
 * Allows test environments to override services with mocks
 */

import { smartGeocode, geocodeByPincode } from '../utils/geocoding';
import { validatePincode } from './pincodeValidator';
import { resolvePincodeAuthoritatively } from '../utils/authoritativePincodeResolver';

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress?: string;
  source?: string;
}

export interface PincodeValidationResult {
  valid: boolean;
  pincode?: string;
  suggestedCity?: string;
  suggestedState?: string;
  suggestedDistrict?: string;
  postOffices?: any[];
}

export interface PincodeResolutionResult {
  state: string;
  postal_district: string;
  admin_district: string;
}

export interface ServiceRegistry {
  geocoding: {
    smartGeocode: (addressLine: string, city: string, state: string, pincode: string) => Promise<GeocodeResult | null>;
    geocodeByPincode: (pincode: string) => Promise<GeocodeResult | null>;
  };
  pincode: {
    validatePincode: (pincode: string) => Promise<PincodeValidationResult>;
    resolvePincodeAuthoritatively: (pincode: string) => Promise<PincodeResolutionResult | null>;
  };
}

// Default production services
const defaultServices: ServiceRegistry = {
  geocoding: {
    smartGeocode,
    geocodeByPincode,
  },
  pincode: {
    validatePincode,
    resolvePincodeAuthoritatively,
  },
};

// Global registry that can be overridden in tests
let currentServices: ServiceRegistry = defaultServices;

export function getServices(): ServiceRegistry {
  return currentServices;
}

export function setServices(services: Partial<ServiceRegistry>): void {
  currentServices = {
    ...defaultServices,
    ...services,
    geocoding: {
      ...defaultServices.geocoding,
      ...(services.geocoding || {}),
    },
    pincode: {
      ...defaultServices.pincode,
      ...(services.pincode || {}),
    },
  };
}

export function resetServices(): void {
  currentServices = defaultServices;
}
