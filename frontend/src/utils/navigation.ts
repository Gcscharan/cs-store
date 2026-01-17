export type NavigateToDestinationParams = {
  destLat: number;
  destLng: number;
  label?: string;
  onStageChange?: (stage: "fetching_location" | "opening_maps") => void;
};

type NavigateResult = {
  openedWith: "origin" | "destination_only";
};

const isIOS = (): boolean => {
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
};

const hasValidCoords = (lat: number, lng: number): boolean => {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    lat !== 0 &&
    lng !== 0 &&
    !Number.isNaN(lat) &&
    !Number.isNaN(lng)
  );
};

const getLivePosition = (): Promise<GeolocationPosition> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  });
};

const openUrl = (url: string): void => {
  window.location.assign(url);
};

export async function navigateToDestination(
  params: NavigateToDestinationParams
): Promise<NavigateResult> {
  const { destLat, destLng, label, onStageChange } = params;

  if (!hasValidCoords(destLat, destLng)) {
    throw new Error("Destination coordinates are invalid");
  }

  const destinationOnlyUrl = `https://www.google.com/maps/search/?api=1&query=${destLat},${destLng}`;

  try {
    onStageChange?.("fetching_location");
    const pos = await getLivePosition();
    const originLat = pos.coords.latitude;
    const originLng = pos.coords.longitude;

    if (!hasValidCoords(originLat, originLng)) {
      openUrl(destinationOnlyUrl);
      return { openedWith: "destination_only" };
    }

    onStageChange?.("opening_maps");

    if (isIOS()) {
      const appleMapsUrl = `maps://maps.apple.com/?saddr=${originLat},${originLng}&daddr=${destLat},${destLng}${
        label ? `&q=${encodeURIComponent(label)}` : ""
      }`;

      window.location.href = appleMapsUrl;

      setTimeout(() => {
        if (document.visibilityState === "visible") {
          openUrl(
            `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}`
          );
        }
      }, 1200);

      return { openedWith: "origin" };
    }

    openUrl(
      `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}`
    );

    return { openedWith: "origin" };
  } catch {
    openUrl(destinationOnlyUrl);
    return { openedWith: "destination_only" };
  }
}
