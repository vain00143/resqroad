import { useCallback, useMemo, useRef, useState, type ComponentType, type Ref } from "react";
import { Linking, StyleSheet, View, type ViewStyle } from "react-native";
import RNWebView from "react-native-webview";

import { mapCenter, mapHtml, type MapCommand, type MapEvent } from "@/components/map/mapHtml";
import { useMapCommands, type MapViewProps } from "@/components/map/useMapCommands";
import { useSession } from "@/lib/session";
import { radius, useTheme } from "@/theme";

export type { MapViewProps };

// react-native-webview 14's prop types collapse to `never` against React
// Native 0.88's types, so describe the props this map uses.
type WebViewHandle = { injectJavaScript: (script: string) => void };
type WebViewProps = {
  ref: Ref<WebViewHandle>;
  source: { html: string; baseUrl: string };
  originWhitelist: string[];
  onLoadStart: () => void;
  onMessage: (event: { nativeEvent: { data: string } }) => void;
  nestedScrollEnabled: boolean;
  setSupportMultipleWindows: boolean;
  onShouldStartLoadWithRequest: (request: { url: string }) => boolean;
  style: ViewStyle;
};
const WebView = RNWebView as unknown as ComponentType<WebViewProps>;

// Leaflet in a WebView. The page's address is the ResQRoad server, which
// gives the OpenStreetMap tile requests the Referer the tile servers require.
export function MapView(props: MapViewProps) {
  const { height, center = mapCenter, zoom = 12, pickable = false, onPick, onMarkerPress, onTouchingChange } = props;
  const { scheme, colors } = useTheme();
  const { serverUrl } = useSession();
  const webView = useRef<WebViewHandle>(null);
  const [ready, setReady] = useState(false);

  // Built once per theme; later changes arrive as commands.
  const html = useMemo(
    () => mapHtml({ dark: scheme === "dark", center, zoom, pickable }),
    [scheme, pickable],
  );
  const baseUrl = (serverUrl || "http://localhost") + "/";

  const send = useCallback((command: MapCommand) => {
    webView.current?.injectJavaScript(
      "window.handleCommand && window.handleCommand(" + JSON.stringify(command) + "); true;",
    );
  }, []);
  useMapCommands(send, ready, props);

  function onMessage(event: { nativeEvent: { data: string } }) {
    let message: MapEvent;
    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (message.type === "ready") {
      setReady(true);
    } else if (message.type === "pick") {
      onPick?.({ lat: message.lat, lng: message.lng });
    } else if (message.type === "marker") {
      onMarkerPress?.(message.id);
    }
  }

  return (
    <View
      style={[styles.box, { height, borderColor: colors.border }]}
      onTouchStart={() => onTouchingChange?.(true)}
      onTouchEnd={() => onTouchingChange?.(false)}
      onTouchCancel={() => onTouchingChange?.(false)}
    >
      <WebView
        key={scheme}
        ref={webView}
        originWhitelist={["*"]}
        source={{ html, baseUrl }}
        onLoadStart={() => setReady(false)}
        onMessage={onMessage}
        nestedScrollEnabled
        setSupportMultipleWindows={false}
        // The attribution link opens in the browser instead of the map.
        onShouldStartLoadWithRequest={(request) => {
          if (request.url.startsWith(baseUrl) || request.url.startsWith("about:") || request.url.startsWith("data:")) {
            return true;
          }
          Linking.openURL(request.url);
          return false;
        }}
        style={{ backgroundColor: scheme === "dark" ? "#24201e" : "#efe6df" }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: "hidden", borderWidth: 1, borderRadius: radius.lg },
});
