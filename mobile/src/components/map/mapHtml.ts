// The map page shown inside a WebView (an iframe on web): Leaflet with
// OpenStreetMap tiles, the same setup as the website's maps. The app sends it
// commands and it reports taps, drags, and marker presses back.

export type MapPoint = { lat: number; lng: number };

export type MapMarker = MapPoint & {
  id: string;
  color: string;
  // "dot" for context (e.g. reports already filed), "pin" for the main places.
  kind: "dot" | "pin";
  label?: string;
};

export type MapCommand =
  | { type: "markers"; markers: MapMarker[]; fit: boolean }
  | { type: "pin"; pin: (MapPoint & { color: string }) | null; pan: boolean };

export type MapEvent =
  | { type: "ready" }
  | { type: "failed" }
  | { type: "pick"; lat: number; lng: number }
  | { type: "marker"; id: string };

// Malolos, as on the website.
export const mapCenter: MapPoint = { lat: 14.866, lng: 120.83 };

type Options = {
  dark: boolean;
  center: MapPoint;
  zoom: number;
  pickable: boolean;
};

export function mapHtml({ dark, center, zoom, pickable }: Options) {
  const land = dark ? "#24201e" : "#efe6df";
  const tileFilter = dark ? "grayscale(1) invert(1) contrast(0.88) brightness(0.82) sepia(0.15)" : "none";
  const text = dark ? "#ebe5e1" : "#2b2522";
  return `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">
<style>
  html, body, #map { height: 100%; margin: 0; background: ${land}; }
  body { font: 13px Poppins, system-ui, sans-serif; color: ${text}; }
  .leaflet-container { background: ${land}; font: inherit; }
  .leaflet-tile-pane { filter: ${tileFilter}; }
  .leaflet-control-attribution { font-size: 10px; }
  .rr-pin { width: 28px; height: 36px; display: block; filter: drop-shadow(0 3px 4px rgb(0 0 0 / 30%)); }
  .rr-pin path { stroke: #fff; stroke-width: 2; stroke-linejoin: round; }
  .rr-pin circle { fill: #fff; }
  #failed { display: none; position: absolute; inset: 0; align-items: center; justify-content: center; padding: 24px; text-align: center; }
</style>
</head><body>
<div id="map"></div>
<div id="failed">The map couldn't load. Check your internet connection.</div>
<script>
  function send(message) {
    var data = JSON.stringify(message);
    if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(data); }
    else if (window.parent !== window) { window.parent.postMessage(data, "*"); }
  }
  function failed() {
    document.getElementById("failed").style.display = "flex";
    send({ type: "failed" });
  }
</script>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin="" onerror="failed()"></script>
<script>
  if (window.L) {
    var map = L.map("map", { zoomControl: false }).setView([${center.lat}, ${center.lng}], ${zoom});
    map.attributionControl.setPrefix(false);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      // OpenStreetMap's tile servers require a Referer.
      referrerPolicy: "origin",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    var markerLayer = L.layerGroup().addTo(map);
    var pin = null;
    var pinPath = '<svg class="rr-pin" viewBox="0 0 28 36"><path fill="COLOR" d="M26.5 13.5c0 9-12.5 22.5-12.5 22.5S1.5 22.5 1.5 13.5a12.5 12.5 0 1 1 25 0Z"/><circle cx="14" cy="13.5" r="4.5"/></svg>';

    function pinIcon(color) {
      return L.divIcon({ className: "", html: pinPath.replace("COLOR", color), iconSize: [28, 36], iconAnchor: [14, 36] });
    }

    function setMarkers(list, fit) {
      markerLayer.clearLayers();
      var points = [];
      list.forEach(function (item) {
        var layer = item.kind === "dot"
          ? L.circleMarker([item.lat, item.lng], { radius: 6, color: "#fff", weight: 2, fillColor: item.color, fillOpacity: 0.9 })
          : L.marker([item.lat, item.lng], { icon: pinIcon(item.color), keyboard: false });
        if (item.label) { layer.bindTooltip(item.label, { direction: "top", offset: [0, item.kind === "dot" ? -6 : -34] }); }
        layer.on("click", function () { send({ type: "marker", id: item.id }); });
        layer.addTo(markerLayer);
        points.push([item.lat, item.lng]);
      });
      if (fit && points.length === 1) { map.setView(points[0], 15, { animate: false }); }
      else if (fit && points.length > 1) { map.fitBounds(points, { padding: [36, 36], maxZoom: 15, animate: false }); }
    }

    function setPin(point, pan) {
      if (!point) {
        if (pin) { map.removeLayer(pin); pin = null; }
        return;
      }
      if (!pin) {
        pin = L.marker([point.lat, point.lng], { icon: pinIcon(point.color), draggable: ${pickable}, keyboard: false, zIndexOffset: 1000 }).addTo(map);
        pin.on("dragend", function () {
          var at = pin.getLatLng();
          send({ type: "pick", lat: at.lat, lng: at.lng });
        });
      } else {
        pin.setLatLng([point.lat, point.lng]);
        pin.setIcon(pinIcon(point.color));
      }
      if (pan) { map.setView([point.lat, point.lng], Math.max(map.getZoom(), 16)); }
    }

    if (${pickable}) {
      map.on("click", function (event) { send({ type: "pick", lat: event.latlng.lat, lng: event.latlng.lng }); });
    }

    window.handleCommand = function (command) {
      if (command.type === "markers") { setMarkers(command.markers, command.fit); }
      if (command.type === "pin") { setPin(command.pin, command.pan); }
    };
    // Messages from the web preview's parent page.
    window.addEventListener("message", function (event) {
      try { window.handleCommand(JSON.parse(event.data)); } catch (error) {}
    });
    send({ type: "ready" });
  } else {
    failed();
  }
</script>
</body></html>`;
}
