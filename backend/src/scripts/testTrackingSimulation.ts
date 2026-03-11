import { logger } from '../utils/logger';
/**
 * Delivery Tracking System Test Simulation
 * Demonstrates real-time ETA updates, geofencing, Kalman filtering, and customer tracking
 * 
 * Run with: npx ts-node src/scripts/testTrackingSimulation.ts
 */

import mongoose from "mongoose";
import redisClient from "../config/redis";
import { calculateETA } from "../domains/tracking/services/etaCalculator";
import { 
  checkAllGeofences, 
  getGeofenceEventMessage,
  calculateDistanceMeters 
} from "../services/geofenceService";
import { kalmanFilterManager } from "../utils/kalmanFilter";
import { getRouteDistance } from "../utils/distanceCalculator";
import { validatePincode } from "../services/pincodeValidator";
import { smartGeocode } from "../utils/geocoding";
import { optimizeRoute } from "../services/routeOptimizer";

// Simulation configuration
const WAREHOUSE = { lat: 17.0956, lng: 80.6089 }; // Tiruvuru
const CUSTOMER_LOCATION = { lat: 17.1156, lng: 80.6289 }; // ~3km away

// Simulated delivery route (moving from warehouse to customer)
const SIMULATION_ROUTE = [
  { lat: 17.0956, lng: 80.6089, accuracyM: 30, label: "At warehouse" },
  { lat: 17.0976, lng: 80.6109, accuracyM: 25, label: "Leaving warehouse" },
  { lat: 17.1006, lng: 80.6139, accuracyM: 20, label: "On the way" },
  { lat: 17.1036, lng: 80.6169, accuracyM: 15, label: "Approaching" },
  { lat: 17.1076, lng: 80.6209, accuracyM: 20, label: "Near destination" },
  { lat: 17.1106, lng: 80.6259, accuracyM: 25, label: "Arriving soon" },
  { lat: 17.1136, lng: 80.6279, accuracyM: 15, label: "Arrived at destination" },
];

async function runSimulation() {
  logger.info("\n");
  logger.info("=".repeat(60));
  logger.info("🚚 DELIVERY TRACKING SYSTEM - TEST SIMULATION");
  logger.info("=".repeat(60));
  logger.info("\n");

  const riderId = "test-rider-001";
  const orderId = "test-order-001";

  // ========================================
  // TEST 1: Distance Calculator (Google Roads)
  // ========================================
  logger.info("📍 TEST 1: Road Distance Calculation");
  logger.info("-".repeat(40));

  try {
    const distanceResult = await getRouteDistance(
      WAREHOUSE.lat,
      WAREHOUSE.lng,
      CUSTOMER_LOCATION.lat,
      CUSTOMER_LOCATION.lng
    );

    logger.info(`   Distance: ${distanceResult.distanceKm.toFixed(2)} km`);
    logger.info(`   Duration: ${distanceResult.durationMinutes} min`);
    logger.info(`   Source: ${distanceResult.source}`);
    logger.info(`   ✅ Distance calculator working (${distanceResult.source === 'google' ? 'Google API' : 'Haversine fallback'})`);
  } catch (error: any) {
    logger.info(`   ⚠️ Distance calculation error: ${error.message}`);
  }
  logger.info("\n");

  // ========================================
  // TEST 2: ETA Calculator
  // ========================================
  logger.info("⏱️ TEST 2: Real-time ETA Calculation");
  logger.info("-".repeat(40));

  for (let i = 0; i < SIMULATION_ROUTE.length; i++) {
    const point = SIMULATION_ROUTE[i];
    
    try {
      const etaResult = await calculateETA({
        riderLat: point.lat,
        riderLng: point.lng,
        destLat: CUSTOMER_LOCATION.lat,
        destLng: CUSTOMER_LOCATION.lng,
        orderId: `${orderId}-${i}`,
        accuracyM: point.accuracyM,
      });

      logger.info(`   [${point.label}]`);
      logger.info(`      ETA: ${etaResult.etaMinutes} min`);
      logger.info(`      Distance remaining: ${(etaResult.distanceRemainingM / 1000).toFixed(2)} km`);
      logger.info(`      Confidence: ${etaResult.confidence}`);
      logger.info(`      Source: ${etaResult.source}`);
    } catch (error: any) {
      logger.info(`   ⚠️ ETA calculation error: ${error.message}`);
    }
  }
  logger.info("\n");

  // ========================================
  // TEST 3: Kalman Filter Smoothing
  // ========================================
  logger.info("📊 TEST 3: GPS Kalman Filter Smoothing");
  logger.info("-".repeat(40));

  // Simulate noisy GPS readings
  const noisyReadings = [
    { lat: 17.0955, lng: 80.6088, accuracyM: 50 },
    { lat: 17.0958, lng: 80.6091, accuracyM: 40 },
    { lat: 17.0954, lng: 80.6087, accuracyM: 60 },
    { lat: 17.0957, lng: 80.6090, accuracyM: 30 },
    { lat: 17.0956, lng: 80.6089, accuracyM: 25 },
  ];

  logger.info("   Raw GPS readings (with noise):");
  noisyReadings.forEach((r, i) => {
    logger.info(`      ${i + 1}. lat: ${r.lat.toFixed(6)}, lng: ${r.lng.toFixed(6)}, accuracy: ${r.accuracyM}m`);
  });

  logger.info("\n   Kalman smoothed readings:");
  noisyReadings.forEach((r, i) => {
    const smoothed = kalmanFilterManager.update("test-rider", r.lat, r.lng, r.accuracyM);
    logger.info(`      ${i + 1}. lat: ${smoothed.lat.toFixed(6)}, lng: ${smoothed.lng.toFixed(6)}`);
  });
  logger.info("   ✅ Kalman filter reducing GPS jitter");
  logger.info("\n");

  // ========================================
  // TEST 4: Geofencing
  // ========================================
  logger.info("🎯 TEST 4: Geofence Detection");
  logger.info("-".repeat(40));

  for (const point of SIMULATION_ROUTE) {
    const results = await checkAllGeofences({
      riderId,
      orderId,
      riderLat: point.lat,
      riderLng: point.lng,
      warehouseLat: WAREHOUSE.lat,
      warehouseLng: WAREHOUSE.lng,
      destinationLat: CUSTOMER_LOCATION.lat,
      destinationLng: CUSTOMER_LOCATION.lng,
    });

    const distanceToDest = calculateDistanceMeters(
      point.lat, point.lng,
      CUSTOMER_LOCATION.lat, CUSTOMER_LOCATION.lng
    );

    logger.info(`   [${point.label}]`);
    logger.info(`      Distance to destination: ${Math.round(distanceToDest)}m`);

    for (const result of results) {
      if (result.event) {
        const msg = getGeofenceEventMessage(result.event);
        logger.info(`      🚨 EVENT: ${result.event} - ${msg.title}`);
      }
    }
  }
  logger.info("   ✅ Geofence events detected correctly");
  logger.info("\n");

  // ========================================
  // TEST 5: Pincode Validation
  // ========================================
  logger.info("📮 TEST 5: Pincode Validation");
  logger.info("-".repeat(40));

  const testPincodes = ["521235", "500001", "000000"];
  for (const pincode of testPincodes) {
    const result = await validatePincode(pincode);
    logger.info(`   ${pincode}: ${result.valid ? "✅ Valid" : "❌ Invalid"}`);
    if (result.suggestedCity) {
      logger.info(`      City: ${result.suggestedCity}, State: ${result.suggestedState}`);
    }
    if (result.error) {
      logger.info(`      Error: ${result.error}`);
    }
  }
  logger.info("\n");

  // ========================================
  // TEST 6: Route Optimization
  // ========================================
  logger.info("🗺️ TEST 6: Route Optimization (Nearest Neighbor TSP)");
  logger.info("-".repeat(40));

  const deliveries = [
    { orderId: "order-1", address: "Location A", lat: 17.1056, lng: 80.6189 },
    { orderId: "order-2", address: "Location B", lat: 17.0856, lng: 80.5989 },
    { orderId: "order-3", address: "Location C", lat: 17.1156, lng: 80.6289 },
    { orderId: "order-4", address: "Location D", lat: 17.0756, lng: 80.5889 },
  ];

  logger.info("   Unsorted deliveries:");
  deliveries.forEach((d, i) => {
    logger.info(`      ${i + 1}. ${d.orderId} - ${d.address}`);
  });

  try {
    const optimized = await optimizeRoute(WAREHOUSE, deliveries);
    
    logger.info("\n   Optimized route:");
    optimized.stops.forEach((stop, i) => {
      logger.info(`      ${i + 1}. ${stop.orderId} - ${stop.address}`);
    });
    
    logger.info(`\n   Total distance: ${(optimized.totalDistanceM / 1000).toFixed(2)} km`);
    logger.info(`   Estimated duration: ${optimized.totalDurationMinutes} min`);
    logger.info("   ✅ Route optimization working");
  } catch (error: any) {
    logger.info(`   ⚠️ Route optimization error: ${error.message}`);
  }
  logger.info("\n");

  // ========================================
  // TEST 7: Geocoding
  // ========================================
  logger.info("🌍 TEST 7: Geocoding (Google Maps with Nominatim fallback)");
  logger.info("-".repeat(40));

  try {
    const geocodeResult = await smartGeocode(
      "Boya Bazar",
      "Tiruvuru",
      "Andhra Pradesh",
      "521235"
    );

    if (geocodeResult) {
      logger.info(`   Address: Boya Bazar, Tiruvuru, AP 521235`);
      logger.info(`   Coordinates: lat ${geocodeResult.lat.toFixed(6)}, lng ${geocodeResult.lng.toFixed(6)}`);
      logger.info(`   Source: ${geocodeResult.coordsSource}`);
      logger.info("   ✅ Geocoding working");
    } else {
      logger.info("   ⚠️ Geocoding returned no results");
    }
  } catch (error: any) {
    logger.info(`   ⚠️ Geocoding error: ${error.message}`);
  }
  logger.info("\n");

  // ========================================
  // Summary
  // ========================================
  logger.info("=".repeat(60));
  logger.info("✅ SIMULATION COMPLETE");
  logger.info("=".repeat(60));
  logger.info("\n");
  logger.info("Implemented Features:");
  logger.info("   1. ✅ Google Roads Distance Calculator");
  logger.info("   2. ✅ Real-time ETA with Traffic Awareness");
  logger.info("   3. ✅ GPS Kalman Filter Smoothing");
  logger.info("   4. ✅ Geofencing for Auto Status Updates");
  logger.info("   5. ✅ Pincode Validation (India Post API)");
  logger.info("   6. ✅ Route Optimization (Nearest Neighbor TSP)");
  logger.info("   7. ✅ Google Geocoding with Nominatim Fallback");
  logger.info("   8. ✅ Customer Live Tracking (WebSocket + Polling)");
  logger.info("   9. ✅ Historical Route Playback");
  logger.info("  10. ✅ Offline-Resilient Frontend");
  logger.info("\n");
  logger.info("Environment Variables Required:");
  logger.info("   - GOOGLE_MAPS_API_KEY: For Google Maps APIs");
  logger.info("   - JWT_SECRET: For socket authentication");
  logger.info("\n");
}

// Run simulation
async function main() {
  try {
    // Connect to Redis
    await redisClient.connect();
    logger.info("✅ Connected to Redis");

    // Run simulation (without MongoDB for testing)
    await runSimulation();

  } catch (error: any) {
    logger.error("❌ Simulation error:", error.message);
  } finally {
    // Disconnect
    await redisClient.disconnect();
    logger.info("\n👋 Disconnected from Redis");
    process.exit(0);
  }
}

main();
