import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { MapView } from "@/components/map/MapView";
import type { MapMarker } from "@/components/map/mapHtml";
import { Notice } from "@/components/Notice";
import { PhotoGallery } from "@/components/PhotoGallery";
import { ReportProgress } from "@/components/ReportProgress";
import { ReportTimeline } from "@/components/ReportTimeline";
import { SeverityBadge } from "@/components/SeverityBadge";
import { StatusPill } from "@/components/StatusPill";
import { api, ApiError, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { normalizeReportId, type Report } from "@/lib/reports";
import { useSession } from "@/lib/session";
import { severityColors, useTheme } from "@/theme";

// One report's public progress. Signed-in people see live changes from the
// shared store; others (tracking by ID) load it from the server.
export default function ReportDetail() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const reportId = normalizeReportId(String(params.id)) ?? String(params.id);
  const { reports, user, refresh } = useSession();
  const stored = reports.find((item) => item.id === reportId) ?? null;
  const [fetched, setFetched] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { report } = await api<{ report: Report }>("/reports/" + encodeURIComponent(reportId));
      setFetched(report);
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 404
          ? "No report found with ID " + reportId + ". Check the number and try again."
          : errorMessage(caught),
      );
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  // Load from the server only when the report isn't in the shared store.
  const missing = stored === null;
  useEffect(() => {
    if (missing) {
      load();
    }
  }, [missing, load]);

  const report = stored ?? fetched;

  // Rebuilt only when the pin itself changes, so live updates don't reset the map.
  const lat = report?.coordinates.lat;
  const lng = report?.coordinates.lng;
  const severity = report?.severity;
  const markers = useMemo<MapMarker[]>(
    () =>
      lat !== undefined && lng !== undefined && severity
        ? [{ id: reportId, lat, lng, color: severityColors[severity], kind: "pin" }]
        : [],
    [reportId, lat, lng, severity],
  );

  async function pullToRefresh() {
    if (stored && user) {
      await refresh().catch(() => {});
    } else {
      await load();
    }
  }

  if (!report) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: reportId }} />
        {loading ? <ActivityIndicator color={colors.accent} /> : null}
        {error ? <Notice tone="error" message={error} /> : null}
        {error ? <Button label="Try again" variant="secondary" onPress={load} /> : null}
      </View>
    );
  }

  const closingNote = [...report.history]
    .reverse()
    .find((entry) => (entry.status === "rejected" || entry.status === "duplicate") && entry.note)?.note;
  const isMine = Boolean(user && report.reporterId === user.id);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={pullToRefresh} tintColor={colors.accent} />}
    >
      <Stack.Screen options={{ title: report.id }} />

      <Card>
        <AppText variant="eyebrow">{report.id}</AppText>
        <AppText variant="title">{report.title}</AppText>
        <View style={styles.tags}>
          <StatusPill status={report.status} />
          <SeverityBadge severity={report.severity} />
        </View>
        <View style={styles.meta}>
          <Icon name="map-pin" size={16} />
          <AppText variant="caption" tone="text2" style={styles.flex}>
            {report.road} · {report.location}
          </AppText>
        </View>
        <View style={styles.meta}>
          <Icon name="calendar" size={16} />
          <AppText variant="caption" tone="text2" style={styles.flex}>
            Reported {formatDate(report.reportedAt)}
            {isMine ? " by you" : ""}
          </AppText>
        </View>
        {report.assignedName ? (
          <View style={styles.meta}>
            <Icon name="hard-hat" size={16} />
            <AppText variant="caption" tone="text2" style={styles.flex}>
              Assigned to {report.assignedName}
            </AppText>
          </View>
        ) : null}
      </Card>

      {report.status === "rejected" ? (
        <Notice tone="error" message={"This report was rejected." + (closingNote ? " Reason: " + closingNote : "")} />
      ) : null}
      {report.status === "duplicate" ? (
        <Notice message={"This report was marked as a duplicate of another report nearby." + (closingNote ? " " + closingNote : "")} />
      ) : null}

      <Card title="Progress">
        <ReportProgress report={report} />
      </Card>

      <Card title="Details">
        <AppText>{report.description}</AppText>
        {report.evidencePhotos.length ? <PhotoGallery photos={report.evidencePhotos} label="Photos" /> : null}
      </Card>

      <Card title="Location">
        <MapView height={200} zoom={15} center={report.coordinates} markers={markers} fitMarkers />
        <AppText variant="caption">
          {report.coordinates.lat.toFixed(5)}, {report.coordinates.lng.toFixed(5)}
        </AppText>
      </Card>

      {report.repair ? (
        <Card title="Repair">
          <AppText variant="caption">Submitted {formatDate(report.repair.submittedAt)}</AppText>
          {report.repair.notes ? <AppText>{report.repair.notes}</AppText> : null}
          {report.repair.beforePhotos.length ? <PhotoGallery photos={report.repair.beforePhotos} label="Before" /> : null}
          {report.repair.afterPhotos.length ? <PhotoGallery photos={report.repair.afterPhotos} label="After" /> : null}
        </Card>
      ) : null}

      <Card title="Activity">
        <ReportTimeline history={report.history} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  center: { flex: 1, gap: 12, padding: 20, justifyContent: "center" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  meta: { flexDirection: "row", alignItems: "center", gap: 8 },
  flex: { flex: 1 },
});
