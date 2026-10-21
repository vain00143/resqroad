import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Linking, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { MapView } from "@/components/map/MapView";
import type { MapMarker } from "@/components/map/mapHtml";
import { OfflineState } from "@/components/OfflineState";
import { ReportRow } from "@/components/ReportRow";
import { directionsUrl, inTab, myJobs } from "@/lib/jobs";
import { severities, type Report } from "@/lib/reports";
import { useSession } from "@/lib/session";
import { brand, severityColors, useTheme } from "@/theme";

function openJob(report: Report) {
  router.push({ pathname: "/jobs/[id]", params: { id: report.id } });
}

// Every job on one map: active jobs as pins in their severity color, and
// submitted or completed ones as grey dots.
export default function RepairSites() {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const { user, reports, loaded, connection } = useSession();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapTouched, setMapTouched] = useState(false);

  const jobs = useMemo(() => myJobs(reports, user?.id), [reports, user?.id]);
  const active = jobs.filter((report) => inTab(report, "active"));
  const selected = jobs.find((report) => report.id === selectedId) ?? null;

  const markers = useMemo<MapMarker[]>(
    () =>
      jobs.map((report) => {
        const isActive = inTab(report, "active");
        return {
          id: report.id,
          lat: report.coordinates.lat,
          lng: report.coordinates.lng,
          color: isActive ? severityColors[report.severity] : brand.asphalt,
          kind: isActive ? "pin" : "dot",
          label: report.id + " · " + report.road,
        };
      }),
    [jobs],
  );

  return (
    <ScrollView contentContainerStyle={styles.content} scrollEnabled={!mapTouched}>
      {connection === "offline" ? <OfflineState compact={loaded} /> : null}

      <MapView
        height={Math.max(280, Math.round(height * 0.45))}
        markers={markers}
        fitMarkers
        onMarkerPress={setSelectedId}
        onTouchingChange={setMapTouched}
      />

      <View style={styles.legend}>
        {severities.map((severity) => (
          <View key={severity} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: severityColors[severity] }]} />
            <AppText variant="caption">{severity}</AppText>
          </View>
        ))}
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: brand.asphalt }]} />
          <AppText variant="caption">Submitted or completed</AppText>
        </View>
      </View>

      {selected ? (
        <Card title="Selected job">
          <ReportRow report={selected} onPress={() => openJob(selected)} />
          <View style={styles.actions}>
            <Button
              label="Directions"
              variant="secondary"
              onPress={() => Linking.openURL(directionsUrl(selected.coordinates))}
              icon={<Icon name="navigation" size={18} color={colors.text} />}
              style={styles.flex}
            />
            <Button label="Open job" onPress={() => openJob(selected)} style={styles.flex} />
          </View>
        </Card>
      ) : null}

      {loaded && jobs.length === 0 ? (
        <Card>
          <AppText tone="text2">No maintenance jobs are assigned to you yet.</AppText>
        </Card>
      ) : null}

      {active.length ? (
        <View style={styles.list}>
          <AppText variant="eyebrow">Active jobs · tap a pin to select</AppText>
          {active.map((report) => (
            <ReportRow key={report.id} report={report} onPress={() => openJob(report)} />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  actions: { flexDirection: "row", gap: 10 },
  list: { gap: 10 },
  flex: { flex: 1 },
});
