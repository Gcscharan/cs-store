import { Loader } from "@googlemaps/js-api-loader";

declare const google: any;

let mapsLoadPromise: Promise<any> | null = null;
let mapsLoadKey: string | null = null;

export const loadGoogleMapsOnce = async (apiKey: string) => {
  if (!apiKey) {
    throw new Error("Missing VITE_GOOGLE_MAPS_API_KEY");
  }

  if (mapsLoadPromise && mapsLoadKey === apiKey) return mapsLoadPromise;

  mapsLoadKey = apiKey;
  const loader = new Loader({
    apiKey,
    version: "weekly",
    libraries: ["geometry", "marker"],
  });

  mapsLoadPromise = (loader as any).load();
  return mapsLoadPromise;
};

export const isGoogleMapsLoaded = () => {
  return typeof google !== "undefined" && Boolean(google?.maps);
};
