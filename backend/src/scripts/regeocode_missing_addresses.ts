/**
 * Migration Script: Re-geocode Missing Address Coordinates
 * 
 * Purpose: Find addresses with missing/invalid coordinates and attempt to geocode them
 * Priority: Critical - Blocks correct delivery fee calculation
 * 
 * Usage:
 *   - Dry run (test mode):  npm run migrate:addresses -- --dry-run
 *   - Live run (updates DB): npm run migrate:addresses
 *   - With throttling:       npm run migrate:addresses -- --throttle=2000
 */

import mongoose from "mongoose";
import { User, IAddress } from "../models/User";
import { smartGeocode, geocodeByPincode } from "../utils/geocoding";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// CRITICAL: Only use MONGODB_URI from environment - no fallbacks
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ CRITICAL: MONGODB_URI environment variable is not set!");
  console.error("❌ Please set MONGODB_URI in your .env file and restart.");
  process.exit(1);
}

// Configuration
const DEFAULT_THROTTLE_MS = 1500; // 1.5 seconds between requests (Nominatim limit: 1 req/sec)
const BATCH_SIZE = 10; // Process in batches to avoid overwhelming API

interface MigrationStats {
  totalAddresses: number;
  invalidAddresses: number;
  geocodedSuccessful: number;
  geocodedPincodeFallback: number;
  geocodingFailed: number;
  skipped: number;
}

interface ProcessedAddress {
  userId: string;
  addressId: string;
  addressLine: string;
  city: string;
  pincode: string;
  oldCoords: { lat: number; lng: number };
  newCoords?: { lat: number; lng: number };
  coordsSource?: 'geocoded' | 'pincode' | 'failed';
  status: 'success' | 'failed' | 'skipped';
  error?: string;
}

/**
 * Check if address coordinates are invalid
 */
function hasInvalidCoordinates(address: IAddress): boolean {
  return (
    !address.lat ||
    !address.lng ||
    address.lat === 0 ||
    address.lng === 0 ||
    isNaN(address.lat) ||
    isNaN(address.lng) ||
    address.lat < 6 || address.lat > 37 ||  // Outside India latitude
    address.lng < 68 || address.lng > 98    // Outside India longitude
  );
}

/**
 * Attempt to geocode a single address
 */
async function attemptGeocode(
  address: IAddress,
  throttleMs: number
): Promise<{ lat: number; lng: number; source: 'geocoded' | 'pincode' } | null> {
  
  // Throttle to respect API limits
  await new Promise(resolve => setTimeout(resolve, throttleMs));

  console.log(`\n🌍 Attempting to geocode: ${address.addressLine}, ${address.city}, ${address.pincode}`);

  // Try full address geocoding
  const fullGeocode = await smartGeocode(
    address.addressLine,
    address.city,
    address.state,
    address.pincode
  );

  if (fullGeocode) {
    console.log(`✅ Full geocoding successful: lat=${fullGeocode.lat}, lng=${fullGeocode.lng}`);
    return { ...fullGeocode, source: 'geocoded' };
  }

  console.warn(`⚠️ Full geocoding failed, trying pincode fallback...`);

  // Fallback to pincode centroid
  const pincodeGeocode = await geocodeByPincode(address.pincode);

  if (pincodeGeocode) {
    console.log(`✅ Pincode geocoding successful: lat=${pincodeGeocode.lat}, lng=${pincodeGeocode.lng}`);
    console.warn(`⚠️ Using PINCODE CENTROID - fee will be estimated`);
    return { ...pincodeGeocode, source: 'pincode' };
  }

  console.error(`❌ All geocoding attempts failed`);
  return null;
}

/**
 * Process addresses in batches
 */
async function processBatch(
  batch: { user: any; address: IAddress }[],
  dryRun: boolean,
  throttleMs: number
): Promise<ProcessedAddress[]> {
  const results: ProcessedAddress[] = [];

  for (const { user, address } of batch) {
    const result: ProcessedAddress = {
      userId: user._id.toString(),
      addressId: address._id.toString(),
      addressLine: address.addressLine,
      city: address.city,
      pincode: address.pincode,
      oldCoords: { lat: address.lat, lng: address.lng },
      status: 'failed'
    };

    try {
      // Check if address needs geocoding
      if (!hasInvalidCoordinates(address)) {
        console.log(`⏭️ Skipping address (has valid coordinates): ${address.addressLine}`);
        result.status = 'skipped';
        results.push(result);
        continue;
      }

      // Attempt geocoding
      const geocodeResult = await attemptGeocode(address, throttleMs);

      if (!geocodeResult) {
        result.status = 'failed';
        result.error = 'Geocoding failed';
        results.push(result);
        continue;
      }

      result.newCoords = { lat: geocodeResult.lat, lng: geocodeResult.lng };
      result.coordsSource = geocodeResult.source;
      result.status = 'success';

      // Update database if not dry run
      if (!dryRun) {
        const userDoc = await User.findOne({ _id: user._id });
        if (userDoc) {
          const addr = userDoc.addresses.find(a => a._id.toString() === address._id.toString());
          if (addr) {
            addr.lat = geocodeResult.lat;
            addr.lng = geocodeResult.lng;
            addr.isGeocoded = true;
            addr.coordsSource = geocodeResult.source;
            await userDoc.save();
            console.log(`💾 Updated address in database`);
          }
        }
      } else {
        console.log(`🔍 [DRY RUN] Would update: lat=${geocodeResult.lat}, lng=${geocodeResult.lng}, source=${geocodeResult.source}`);
      }

      results.push(result);

    } catch (error: any) {
      result.status = 'failed';
      result.error = error.message;
      results.push(result);
      console.error(`❌ Error processing address:`, error.message);
    }
  }

  return results;
}

/**
 * Main migration function
 */
async function migrateAddresses(dryRun: boolean = true, throttleMs: number = DEFAULT_THROTTLE_MS) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🚀 Starting Address Re-Geocoding Migration`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no changes)' : '💾 LIVE RUN (will update database)'}`);
  console.log(`Throttle: ${throttleMs}ms between requests`);
  console.log(`${'='.repeat(80)}\n`);

  const stats: MigrationStats = {
    totalAddresses: 0,
    invalidAddresses: 0,
    geocodedSuccessful: 0,
    geocodedPincodeFallback: 0,
    geocodingFailed: 0,
    skipped: 0
  };

  const allResults: ProcessedAddress[] = [];

  try {
    // Connect to MongoDB Atlas
    console.log(`📡 Connecting to MongoDB Atlas: MONGODB_URI\n`);
    await mongoose.connect(MONGODB_URI as string);
    console.log(`✅ Connected to MongoDB Atlas\n`);

    // Find all users with addresses
    const users = await User.find({ 'addresses.0': { $exists: true } });
    console.log(`👥 Found ${users.length} users with addresses\n`);

    // Collect all addresses that need processing
    const addressesToProcess: { user: any; address: IAddress }[] = [];

    for (const user of users) {
      for (const address of user.addresses) {
        stats.totalAddresses++;
        
        if (hasInvalidCoordinates(address)) {
          stats.invalidAddresses++;
          addressesToProcess.push({ user, address });
          console.log(`❌ Invalid coordinates found: ${address.addressLine} (lat=${address.lat}, lng=${address.lng})`);
        }
      }
    }

    console.log(`\n📊 Summary: ${stats.totalAddresses} total addresses, ${stats.invalidAddresses} need geocoding\n`);

    if (stats.invalidAddresses === 0) {
      console.log(`✅ No addresses need geocoding. All addresses have valid coordinates!\n`);
      return;
    }

    // Process in batches
    console.log(`🔄 Processing ${stats.invalidAddresses} addresses in batches of ${BATCH_SIZE}...\n`);

    for (let i = 0; i < addressesToProcess.length; i += BATCH_SIZE) {
      const batch = addressesToProcess.slice(i, i + BATCH_SIZE);
      console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(addressesToProcess.length / BATCH_SIZE)} (${batch.length} addresses)`);
      
      const batchResults = await processBatch(batch, dryRun, throttleMs);
      allResults.push(...batchResults);

      // Update stats
      for (const result of batchResults) {
        if (result.status === 'success') {
          if (result.coordsSource === 'geocoded') {
            stats.geocodedSuccessful++;
          } else if (result.coordsSource === 'pincode') {
            stats.geocodedPincodeFallback++;
          }
        } else if (result.status === 'failed') {
          stats.geocodingFailed++;
        } else if (result.status === 'skipped') {
          stats.skipped++;
        }
      }

      console.log(`\n✅ Batch complete. Progress: ${i + batch.length}/${addressesToProcess.length}`);
    }

  } catch (error: any) {
    console.error(`\n❌ Migration failed:`, error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log(`\n📡 Disconnected from MongoDB\n`);
  }

  // Print final report
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 MIGRATION COMPLETE - Final Report`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Total addresses scanned:        ${stats.totalAddresses}`);
  console.log(`Addresses with invalid coords:  ${stats.invalidAddresses}`);
  console.log(`✅ Successfully geocoded:       ${stats.geocodedSuccessful}`);
  console.log(`⚠️  Geocoded via pincode:       ${stats.geocodedPincodeFallback}`);
  console.log(`❌ Geocoding failed:            ${stats.geocodingFailed}`);
  console.log(`⏭️  Skipped (already valid):    ${stats.skipped}`);
  console.log(`${'='.repeat(80)}\n`);

  // Print detailed results for failed addresses
  if (stats.geocodingFailed > 0) {
    console.log(`\n⚠️  FAILED ADDRESSES (require manual intervention):`);
    console.log(`${'='.repeat(80)}`);
    allResults
      .filter(r => r.status === 'failed')
      .forEach(r => {
        console.log(`\n❌ User ID: ${r.userId}`);
        console.log(`   Address: ${r.addressLine}, ${r.city}, ${r.pincode}`);
        console.log(`   Error: ${r.error || 'Unknown'}`);
      });
    console.log(`\n${'='.repeat(80)}\n`);
  }

  // Print pincode fallback addresses
  if (stats.geocodedPincodeFallback > 0) {
    console.log(`\n⚠️  PINCODE FALLBACK ADDRESSES (estimated coordinates):`);
    console.log(`${'='.repeat(80)}`);
    allResults
      .filter(r => r.coordsSource === 'pincode')
      .forEach(r => {
        console.log(`\n📍 User ID: ${r.userId}`);
        console.log(`   Address: ${r.addressLine}, ${r.city}, ${r.pincode}`);
        console.log(`   New coords: lat=${r.newCoords?.lat}, lng=${r.newCoords?.lng}`);
        console.log(`   ⚠️  Using pincode centroid - delivery fees will be ESTIMATED`);
      });
    console.log(`\n${'='.repeat(80)}\n`);
  }

  console.log(`\n✅ Migration completed ${dryRun ? 'in DRY RUN mode (no changes made)' : 'and database updated'}\n`);
}

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const throttleArg = args.find(arg => arg.startsWith('--throttle='));
const throttleMs = throttleArg ? parseInt(throttleArg.split('=')[1]) : DEFAULT_THROTTLE_MS;

// Run migration
migrateAddresses(isDryRun, throttleMs)
  .then(() => {
    console.log(`✅ Script completed successfully`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(`❌ Script failed:`, error);
    process.exit(1);
  });
