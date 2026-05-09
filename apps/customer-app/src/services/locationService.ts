// apps/customer-app/src/services/locationService.ts

import * as Location from "expo-location";
import { driverLocationStore } from "../simulator/driverLocationStore";

const DEV_MODE =
  __DEV__ || process.env.EXPO_PUBLIC_DEV_MODE === "true";

const WAREHOUSE = { lat: 17.0956, lng: 80.6089 };

export async function getDriverLocation(): Promise<{
  lat: number;
  lng: number;
}> {
  // 🔥 DEV MODE → use simulator
  if (DEV_MODE) {
    const simulated = driverLocationStore.current;

    if (simulated) {
      return simulated;
    }

    // safe fallback (prevents crash before simulation starts)
    return WAREHOUSE;
  }

  // 🌍 PROD MODE → real GPS
  const { status } =
    await Location.requestForegroundPermissionsAsync();

  if (status !== "granted") {
    throw new Error("Location permission denied");
  }

  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
  };
}