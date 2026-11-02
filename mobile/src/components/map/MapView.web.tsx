import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { mapCenter, mapHtml, type MapCommand, type MapEvent } from "@/components/map/mapHtml";
import { useMapCommands, type MapViewProps } from "@/components/map/useMapCommands";
import { radius, useTheme } from "@/theme";

export type { MapViewProps };

// The browser build has no WebView, so the same map page runs in an iframe.
export function MapView(props: MapViewProps) {
  const { height, center = mapCenter, zoom = 12, pickable = false, onPick, onMarkerPress } = props;
  const { scheme, colors } = useTheme();
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);

  const html = useMemo(
    () => mapHtml({ dark: scheme === "dark", center, zoom, pickable }),
    [scheme, pickable],
  );

  const send = useCallback((command: MapCommand) => {
    frame.current?.contentWindow?.postMessage(JSON.stringify(command), "*");
  }, []);
  useMapCommands(send, ready, props);

  // Keep the latest handlers without re-subscribing.
  const handlers = useRef({ onPick, onMarkerPress });
  handlers.current = { onPick, onMarkerPress };

  useEffect(() => {
    setReady(false);
    function listen(event: MessageEvent) {
      if (!frame.current || event.source !== frame.current.contentWindow || typeof event.data !== "string") {
        return;
      }
      let message: MapEvent;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.type === "ready") {
        setReady(true);
      } else if (message.type === "pick") {
        handlers.current.onPick?.({ lat: message.lat, lng: message.lng });
      } else if (message.type === "marker") {
        handlers.current.onMarkerPress?.(message.id);
      }
    }
    window.addEventListener("message", listen);
    return () => window.removeEventListener("message", listen);
  }, [html]);

  return (
    <View style={[styles.box, { height, borderColor: colors.border }]}>
      {createElement("iframe", {
        key: html,
        ref: frame,
        srcDoc: html,
        title: "Map",
        style: { border: 0, width: "100%", height: "100%" },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: "hidden", borderWidth: 1, borderRadius: radius.lg },
});
