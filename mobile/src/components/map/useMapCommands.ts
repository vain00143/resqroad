import { useEffect, useRef } from "react";

import type { MapCommand, MapMarker, MapPoint } from "@/components/map/mapHtml";

export type MapViewProps = {
  height: number;
  center?: MapPoint;
  zoom?: number;
  markers?: MapMarker[];
  // Zoom to the markers the first time they arrive.
  fitMarkers?: boolean;
  // The draggable pin of a location picker (or a fixed pin).
  pin?: (MapPoint & { color: string }) | null;
  // Change this value to pan the map to the pin (e.g. after "Use my location").
  panKey?: number;
  // Taps and drags choose a location.
  pickable?: boolean;
  onPick?: (point: MapPoint) => void;
  onMarkerPress?: (id: string) => void;
  // True while a finger is on the map, so a parent ScrollView can pause.
  onTouchingChange?: (touching: boolean) => void;
};

// Keeps the map page in step with the props once it has loaded.
export function useMapCommands(send: (command: MapCommand) => void, ready: boolean, props: MapViewProps) {
  const { markers, fitMarkers, pin, panKey } = props;
  const fitted = useRef(false);
  const lastPanKey = useRef(panKey);

  useEffect(() => {
    if (!ready) {
      fitted.current = false;
      return;
    }
    const list = markers ?? [];
    send({ type: "markers", markers: list, fit: Boolean(fitMarkers) && !fitted.current });
    if (list.length) {
      fitted.current = true;
    }
  }, [ready, markers, fitMarkers, send]);

  const pinLat = pin?.lat;
  const pinLng = pin?.lng;
  const pinColor = pin?.color;
  useEffect(() => {
    if (!ready) {
      return;
    }
    const pan = panKey !== lastPanKey.current;
    lastPanKey.current = panKey;
    send({
      type: "pin",
      pin: pinLat === undefined || pinLng === undefined ? null : { lat: pinLat, lng: pinLng, color: pinColor ?? "#B34F2F" },
      pan,
    });
  }, [ready, pinLat, pinLng, pinColor, panKey, send]);
}
