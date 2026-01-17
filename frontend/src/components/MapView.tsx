import { useEffect, useRef, useState } from "react";
import { loadGoogleMapsOnce } from "../utils/googleMapsLoader";

// Google Maps can load at runtime; relax types for build-time safety
declare const google: any;

interface MapViewProps {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: Array<{
    id: string;
    position: { lat: number; lng: number };
    title: string;
    icon?: string;
    info?: string;
  }>;
  polylines?: Array<{
    path: Array<{ lat: number; lng: number }>;
    color?: string;
    weight?: number;
  }>;
  onMarkerClick?: (markerId: string) => void;
  className?: string;
}

const MapView = ({
  center,
  zoom = 15,
  markers = [],
  polylines = [],
  onMarkerClick,
  className = "",
}: MapViewProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any | null>(null);
  const [mapMarkers, setMapMarkers] = useState<any[]>([]);
  const [mapPolylines, setMapPolylines] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initMap = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
        if (!apiKey) {
          throw new Error("Missing VITE_GOOGLE_MAPS_API_KEY");
        }

        const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || "";
        if (!mapId) {
          throw new Error(
            "Missing VITE_GOOGLE_MAPS_MAP_ID. A Map ID is required for Advanced Markers (AdvancedMarkerElement)."
          );
        }

        await loadGoogleMapsOnce(apiKey);

        if (!mapRef.current) return;

        const mapInstance = new google.maps.Map(mapRef.current, {
          center,
          zoom,
          mapId,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
          clickableIcons: false,
          disableDefaultUI: false,
          zoomControl: true,
          fullscreenControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          keyboardShortcuts: true,
          gestureHandling: "greedy",
          draggable: true,
          scrollwheel: true,
          disableDoubleClickZoom: false,
          styles: [
            {
              featureType: "poi",
              elementType: "labels",
              stylers: [{ visibility: "off" }],
            },
          ],
        });

        setMap(mapInstance);
      } catch (err) {
        console.error("Error loading Google Maps:", err);
        setError("Failed to load map");
      } finally {
        setIsLoading(false);
      }
    };

    initMap();
  }, []);

  // Update markers when markers prop changes
  useEffect(() => {
    if (!map) return;

    // Clear existing markers
    mapMarkers.forEach((marker) => marker.setMap(null));
    setMapMarkers([]);

    // Add new markers
    const newMarkers = markers.map((markerData) => {
      const marker = new google.maps.Marker({
        position: markerData.position,
        map,
        title: markerData.title,
        icon: markerData.icon
          ? {
              url: markerData.icon,
              scaledSize: new google.maps.Size(32, 32),
            }
          : undefined,
      });

      if (markerData.info) {
        const infoWindow = new google.maps.InfoWindow({
          content: markerData.info,
        });

        marker.addListener("click", () => {
          infoWindow.open(map, marker);
          if (onMarkerClick) {
            onMarkerClick(markerData.id);
          }
        });
      }

      return marker;
    });

    setMapMarkers(newMarkers);
  }, [map, markers, onMarkerClick]);

  // Update polylines when polylines prop changes
  useEffect(() => {
    if (!map) return;

    // Clear existing polylines
    mapPolylines.forEach((polyline) => polyline.setMap(null));
    setMapPolylines([]);

    // Add new polylines
    const newPolylines = polylines.map((polylineData) => {
      const polyline = new google.maps.Polyline({
        path: polylineData.path,
        geodesic: true,
        strokeColor: polylineData.color || "#0ea5e9",
        strokeOpacity: 1.0,
        strokeWeight: polylineData.weight || 3,
        map,
      });

      return polyline;
    });

    setMapPolylines(newPolylines);
  }, [map, polylines]);

  // Update map center when center prop changes
  useEffect(() => {
    if (map) {
      map.setCenter(center);
    }
  }, [map, center]);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 ${className}`}
      >
        <div className="text-center">
          <div className="text-4xl mb-2">🗺️</div>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
            <p className="text-gray-600">Loading map...</p>
          </div>
        </div>
      )}
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
};

export default MapView;
