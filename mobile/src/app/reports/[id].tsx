import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Section } from "@/components/Card";
import { FeedbackInvite } from "@/components/FeedbackInvite";
import { FeedbackSummary } from "@/components/FeedbackSummary";
import { Icon } from "@/components/Icon";
import { MapView } from "@/components/map/MapView";
import type { MapMarker } from "@/components/map/mapHtml";
import { Notice } from "@/components/Notice";
import { PhotoGallery } from "@/components/PhotoGallery";
import { MetaLine, ReportHeading } from "@/components/ReportHeading";
import { ReportProgress } from "@/components/ReportProgress";
import { ReportTimeline } from "@/components/ReportTimeline";
import { api, ApiError, errorMessage } from "@/lib/api";
import { canGiveFeedback } from "@/lib/feedback";
import { formatDate, formatShortDay } from "@/lib/format";
import { normalizeReportId, type Report } from "@/lib/reports";
import { useSession } from "@/lib/session";
import { severityColors, useTheme } from "@/theme";

// One report's public progress, as one page: the title, photos, description,
// progress, location, and activity. Signed-in people see live changes
// from the shared store; others (tracking by ID) load it from the server.
export default function ReportDetail() {
  const { colors } = useTheme();
  const router = useRouter();
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
  const photoCount = report.evidencePhotos.length;

  return (
    <ScrollView
      style={{ backgroundColor: colors.surface }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={pullToRefresh} tintColor={colors.accent} />}
    >
      <Stack.Screen options={{ title: report.id }} />

      <ReportHeading report={report}>
        <MetaLine icon="calendar">
          Reported {formatDate(report.reportedAt)}
          {isMine ? " by you" : ""}
        </MetaLine>
        {report.assignedName ? <MetaLine icon="hard-hat">Assigned to {report.assignedName}</MetaLine> : null}
      </ReportHeading>

      {isMine && canGiveFeedback(report) ? (
        <View style={styles.notice}>
          <FeedbackInvite reportId={report.id} />
        </View>
      ) : null}

      {report.status === "rejected" ? (
        <View style={styles.notice}>
          <Notice tone="error" message={"This report was rejected." + (closingNote ? " Reason: " + closingNote : "")} />
        </View>
      ) : null}
      {report.status === "duplicate" ? (
        <View style={styles.notice}>
          <Notice
            message={"This report was marked as a duplicate of another report nearby." + (closingNote ? " " + closingNote : "")}
          />
        </View>
      ) : null}

      {photoCount ? (
        <Section
          title="Photos"
          aside={
            <AppText variant="caption">
              {photoCount} {photoCount === 1 ? "photo" : "photos"} · tap to enlarge
            </AppText>
          }
        >
          <PhotoGallery photos={report.evidencePhotos} />
        </Section>
      ) : null}

      <Section title="Description">
        <AppText>{report.description}</AppText>
      </Section>

      <Section title="Progress">
        <ReportProgress report={report} />
      </Section>

      <Section title="Location">
        <MapView height={180} zoom={15} center={report.coordinates} markers={markers} fitMarkers />
        <MetaLine icon="map-pin">
          {report.road} · {report.location}
        </MetaLine>
        <AppText variant="caption">
          {report.coordinates.lat.toFixed(5)}, {report.coordinates.lng.toFixed(5)}
        </AppText>
      </Section>

      {report.repair ? (
        <Section title="Repair">
          <AppText variant="caption">Submitted {formatDate(report.repair.submittedAt)}</AppText>
          {report.repair.notes ? <AppText>{report.repair.notes}</AppText> : null}
          {report.repair.afterPhotos.length ? <PhotoGallery photos={report.repair.afterPhotos} label="After" /> : null}
          {report.repair.beforePhotos.length ? <PhotoGallery photos={report.repair.beforePhotos} label="Before" /> : null}
        </Section>
      ) : null}

      {isMine && report.status === "resolved" ? (
        <Section
          title="Your feedback"
          aside={report.feedback ? <AppText variant="caption">Sent {formatShortDay(report.feedback.at)}</AppText> : null}
        >
          {report.feedback ? (
            <>
              <FeedbackSummary feedback={report.feedback} />
              <AppText variant="caption">Thank you. The Road Maintenance Office reads every response.</AppText>
            </>
          ) : (
            <>
              <AppText tone="text2">You haven't given feedback on this repair yet.</AppText>
              <Button
                label="Give feedback"
                variant="secondary"
                size="sm"
                onPress={() => router.push({ pathname: "/feedback/[id]", params: { id: report.id } })}
                icon={<Icon name="star" size={14} color={colors.text} />}
                style={styles.start}
              />
            </>
          )}
        </Section>
      ) : null}

      <Section title="Activity">
        <ReportTimeline history={report.history} byViewer={isMine} />
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  notice: { paddingBottom: 14 },
  center: { flex: 1, gap: 12, padding: 20, justifyContent: "center" },
  start: { alignSelf: "flex-start" },
});
