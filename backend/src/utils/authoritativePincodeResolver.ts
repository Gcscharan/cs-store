import { resolvePincodeDetails, applyDistrictOverride } from './pincodeResolver';

export interface ResolvedPincodeAuthoritative {
  state: string;
  postal_district: string;
  admin_district: string;
  cities: string[];
}

/**
 * Authoritative pincode resolver for address save operations
 * Ensures CSV-first consistency between /api/pincode/check and address save
 */
export async function resolvePincodeAuthoritatively(
  pincode: string
): Promise<ResolvedPincodeAuthoritative | null> {
  console.info(`[resolvePincodeAuthoritatively] Resolving pincode: ${pincode}`);
  
  const resolved = await resolvePincodeDetails(pincode);
  
  if (!resolved) {
    console.warn(`[resolvePincodeAuthoritatively] Pincode not found: ${pincode}`);
    return null;
  }

  if (!resolved.state || !resolved.postal_district) {
    console.warn(`[resolvePincodeAuthoritatively] Missing state/district for pincode: ${pincode}`, {
      state: resolved.state,
      postal_district: resolved.postal_district,
    });
    return null;
  }

  const admin_district = applyDistrictOverride(resolved.state, resolved.postal_district);
  
  if (!admin_district) {
    console.warn(`[resolvePincodeAuthoritatively] No admin district for pincode: ${pincode}`, {
      state: resolved.state,
      postal_district: resolved.postal_district,
    });
    return null;
  }

  console.info(`[resolvePincodeAuthoritatively] Successfully resolved pincode: ${pincode}`, {
    state: resolved.state,
    postal_district: resolved.postal_district,
    admin_district,
    citiesCount: resolved.cities.length,
  });

  return {
    state: resolved.state,
    postal_district: resolved.postal_district,
    admin_district,
    cities: resolved.cities,
  };
}
