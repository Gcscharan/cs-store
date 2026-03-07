import { useState, useEffect, useCallback } from "react";

export type GeolocationPermissionState = "granted" | "denied" | "prompt" | null;

export interface GeolocationError {
  code: number;
  message: string;
  type: "permission_denied" | "position_unavailable" | "timeout" | "unknown";
}

export interface UseGeolocationResult {
  loading: boolean;
  position: GeolocationPosition | null;
  error: GeolocationError | null;
  permissionState: GeolocationPermissionState;
  requestPosition: () => Promise<GeolocationPosition | null>;
  checkPermission: () => Promise<GeolocationPermissionState>;
}

const ERROR_MESSAGES: Record<number, string> = {
  1: "Location is turned off. Please enable location access in your browser settings.",
  2: "We couldn't determine your location. Please check your internet or WiFi connection.",
  3: "Location request timed out. Please try again.",
};

function getGeolocationErrorMessage(code: number): string {
  return ERROR_MESSAGES[code] || "Unable to fetch your location.";
}

function mapGeolocationError(error: GeolocationPositionError): GeolocationError {
  let type: GeolocationError["type"];

  switch (error.code) {
    case error.PERMISSION_DENIED:
      type = "permission_denied";
      break;
    case error.POSITION_UNAVAILABLE:
      type = "position_unavailable";
      break;
    case error.TIMEOUT:
      type = "timeout";
      break;
    default:
      type = "unknown";
  }

  return {
    code: error.code,
    message: getGeolocationErrorMessage(error.code),
    type,
  };
}

export function useGeolocation(): UseGeolocationResult {
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<GeolocationError | null>(null);
  const [permissionState, setPermissionState] = useState<GeolocationPermissionState>(null);

  const checkPermission = useCallback(async (): Promise<GeolocationPermissionState> => {
    if (!navigator.permissions) {
      setPermissionState(null);
      return null;
    }

    try {
      const result = await navigator.permissions.query({ name: "geolocation" as PermissionName });
      const state = result.state as GeolocationPermissionState;
      setPermissionState(state);
      return state;
    } catch {
      setPermissionState(null);
      return null;
    }
  }, []);

  useEffect(() => {
    void checkPermission();
  }, [checkPermission]);

  const requestPosition = useCallback(async (): Promise<GeolocationPosition | null> => {
    if (!navigator.geolocation) {
      const geoError: GeolocationError = {
        code: 0,
        message: "Geolocation is not supported by your browser.",
        type: "unknown",
      };
      setError(geoError);
      return null;
    }

    const permState = await checkPermission();

    if (permState === "denied") {
      const deniedError: GeolocationError = {
        code: 1,
        message: "Location access is blocked. Please enable it in your browser settings.",
        type: "permission_denied",
      };
      setError(deniedError);
      return null;
    }

    setLoading(true);
    setError(null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPosition(pos);
          setLoading(false);
          setPermissionState("granted");
          resolve(pos);
        },
        (err) => {
          const mappedError = mapGeolocationError(err);
          setError(mappedError);
          setLoading(false);
          if (err.code === err.PERMISSION_DENIED) {
            setPermissionState("denied");
          }
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  }, [checkPermission]);

  return {
    loading,
    position,
    error,
    permissionState,
    requestPosition,
    checkPermission,
  };
}

export default useGeolocation;
