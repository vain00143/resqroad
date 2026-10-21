import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewInstance,
} from "react-native";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Icon } from "@/components/Icon";
import { MapView } from "@/components/map/MapView";
import type { MapMarker } from "@/components/map/mapHtml";
import { Notice } from "@/components/Notice";
import { PhotoGallery } from "@/components/PhotoGallery";
import { PhotoPicker } from "@/components/PhotoPicker";
import { ReportProgress } from "@/components/ReportProgress";
import { ReportTimeline } from "@/components/ReportTimeline";
import { SeverityBadge } from "@/components/SeverityBadge";
import { StatusPill } from "@/components/StatusPill";
import { TextField } from "@/components/TextField";
import { api, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { directionsUrl, lastEvent, moreWorkNote } from "@/lib/jobs";
import { appendPhoto, type LocalPhoto } from "@/lib/photos";
import { normalizeReportId, type Report, type ReportStatus } from "@/lib/reports";
import { useSession } from "@/lib/session";
import { severityColors, useTheme } from "@/theme";

type Draft = { notes: string; before: LocalPhoto[]; after: LocalPhoto[] };

// Unsent repair notes and photos stay put while the crew looks at other
// screens, as on the website.
const drafts = new Map<string, Draft>();
const emptyDraft: Draft = { notes: "", before: [], after: [] };

// A result message belongs to the status it describes, so it hides once the
// job moves on (for example when an administrator sends a repair back).
type Message = { tone: "success" | "error"; text: string; status: ReportStatus };

export default function JobDetail() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const reportId = normalizeReportId(String(params.id)) ?? String(params.id);
  const { user, reports, loaded, refresh, upsertReport } = useSession();
  const report = reports.find((item) => item.id === reportId) ?? null;
  const scroll = useRef<ScrollViewInstance>(null);

  const [draft, setDraftState] = useState<Draft>(() => drafts.get(reportId) ?? emptyDraft);
  const [message, setMessage] = useState<Message | null>(null);
  // Problems with the repair form, shown next to its submit button.
  const [formError, setFormError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  function setDraft(update: Partial<Draft>) {
    setFormError(null);
    setDraftState((current) => {
      const next = { ...current, ...update };
      drafts.set(reportId, next);
      return next;
    });
  }

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

  function show(next: Message) {
    setMessage(next);
    scroll.current?.scrollTo({ y: 0, animated: true });
  }

  async function act(path: "start" | "repair", form?: FormData) {
    const { report: updated } = await api<{ report: Report }>("/reports/" + reportId + "/" + path, {
      method: "POST",
      form,
      timeoutMs: form ? 90000 : 15000,
    });
    upsertReport(updated);
  }

  async function start() {
    setStarting(true);
    try {
      await act("start");
      show({ tone: "success", text: "Repair started on " + reportId + ".", status: "in_progress" });
    } catch (error) {
      show({ tone: "error", text: errorMessage(error), status: "assigned" });
    } finally {
      setStarting(false);
    }
  }

  function askToSubmit() {
    if (!draft.notes.trim() || draft.before.length === 0 || draft.after.length === 0) {
      setFormError("Add repair notes and choose at least one before and after photo.");
      return;
    }
    setFormError(null);
    setConfirming(true);
  }

  async function submit() {
    setConfirming(false);
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("notes", draft.notes.trim());
      for (const photo of draft.before) {
        await appendPhoto(form, "before", photo);
      }
      for (const photo of draft.after) {
        await appendPhoto(form, "after", photo);
      }
      await act("repair", form);
      drafts.delete(reportId);
      setDraftState(emptyDraft);
      show({ tone: "success", text: reportId + " sent to the administrator for verification.", status: "repair_submitted" });
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function pullToRefresh() {
    setRefreshing(true);
    await refresh().catch(() => {});
    setRefreshing(false);
  }

  if (!report) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: reportId }} />
        {loaded ? (
          <Notice tone="error" message={"Job " + reportId + " isn't available. It may have been reassigned."} />
        ) : (
          <ActivityIndicator color={colors.accent} />
        )}
      </View>
    );
  }

  const mine = report.assignedTo === user?.id;
  const sentBack = mine ? moreWorkNote(report) : null;
  const assigned = lastEvent(report, "assigned");

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen options={{ title: report.id }} />
      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} tintColor={colors.accent} />}
      >
        {message && message.status === report.status ? <Notice tone={message.tone} message={message.text} /> : null}
        {sentBack ? <Notice tone="warning" title="More work requested by the administrator" message={sentBack} /> : null}
        {!mine ? <Notice tone="error" message="This job is no longer assigned to you." /> : null}

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
          {assigned ? (
            <View style={styles.meta}>
              <Icon name="clipboard-check" size={16} />
              <AppText variant="caption" tone="text2" style={styles.flex}>
                Assigned {formatDate(assigned.at)} by {assigned.actor}
              </AppText>
            </View>
          ) : null}
          <View style={styles.actions}>
            <Button
              label="Directions"
              variant="secondary"
              onPress={() => Linking.openURL(directionsUrl(report.coordinates))}
              icon={<Icon name="navigation" size={18} color={colors.text} />}
              style={styles.flex}
            />
            {mine && report.status === "assigned" ? (
              <Button
                label="Start repair"
                loading={starting}
                onPress={start}
                icon={<Icon name="play" size={18} color="#FFFFFF" />}
                style={styles.flex}
              />
            ) : null}
          </View>
        </Card>

        {mine && report.status === "in_progress" ? (
          <Card title="Submit repair update">
            <TextField
              label="Repair notes"
              value={draft.notes}
              onChangeText={(notes) => setDraft({ notes })}
              maxLength={1000}
              multiline
              placeholder="Describe the inspection and repair work completed"
            />
            <View style={styles.photoField}>
              <AppText variant="label" tone="heading">
                Before photos
              </AppText>
              <PhotoPicker
                photos={draft.before}
                onChange={(before) => setDraft({ before })}
                onError={setFormError}
              />
            </View>
            <View style={styles.photoField}>
              <AppText variant="label" tone="heading">
                After photos
              </AppText>
              <PhotoPicker
                photos={draft.after}
                onChange={(after) => setDraft({ after })}
                onError={setFormError}
              />
            </View>
            <AppText variant="caption">
              Choose at least one photo for both. They're resized before upload so the administrator can compare them.
            </AppText>
            {formError ? <Notice tone="error" message={formError} /> : null}
            <Button
              label="Submit repair for review"
              size="lg"
              loading={submitting}
              onPress={askToSubmit}
              icon={<Icon name="send" size={18} color="#FFFFFF" />}
            />
          </Card>
        ) : null}

        {report.repair ? (
          <Card title={report.status === "in_progress" ? "Previous repair update" : "Repair update"}>
            {report.status === "repair_submitted" ? (
              <Notice message="Waiting for an administrator to verify this repair." />
            ) : null}
            {report.status === "resolved" ? (
              <Notice tone="success" message="Verified by the administrator. This repair is complete." />
            ) : null}
            <AppText variant="caption">Submitted {formatDate(report.repair.submittedAt)}</AppText>
            {report.repair.notes ? <AppText>{report.repair.notes}</AppText> : null}
            {report.repair.beforePhotos.length ? <PhotoGallery photos={report.repair.beforePhotos} label="Before" /> : null}
            {report.repair.afterPhotos.length ? <PhotoGallery photos={report.repair.afterPhotos} label="After" /> : null}
          </Card>
        ) : null}

        <Card title="Reported damage">
          <AppText>{report.description}</AppText>
          <AppText variant="caption">Reported {formatDate(report.reportedAt)}</AppText>
          {report.evidencePhotos.length ? <PhotoGallery photos={report.evidencePhotos} label="Photos from the resident" /> : null}
        </Card>

        <Card title="Location">
          <MapView height={200} zoom={15} center={report.coordinates} markers={markers} fitMarkers />
          <AppText variant="caption">
            {report.coordinates.lat.toFixed(5)}, {report.coordinates.lng.toFixed(5)}
          </AppText>
        </Card>

        <Card title="Progress">
          <ReportProgress report={report} />
        </Card>

        <Card title="Activity">
          <ReportTimeline history={report.history} />
        </Card>
      </ScrollView>

      <ConfirmDialog
        visible={confirming}
        icon="send"
        kicker="Repair update"
        title="Submit this repair for review?"
        message={reportId + " will be sent to an administrator to verify the repair."}
        confirmLabel="Submit repair"
        onCancel={() => setConfirming(false)}
        onConfirm={submit}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  center: { flex: 1, padding: 20, justifyContent: "center" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  meta: { flexDirection: "row", alignItems: "center", gap: 8 },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
  photoField: { gap: 8 },
  flex: { flex: 1 },
});
