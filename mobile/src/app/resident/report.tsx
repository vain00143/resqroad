import * as Location from "expo-location";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ScrollViewInstance } from "react-native";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { FormSection } from "@/components/FormSection";
import { Icon } from "@/components/Icon";
import { MapView } from "@/components/map/MapView";
import type { MapMarker, MapPoint } from "@/components/map/mapHtml";
import { Notice } from "@/components/Notice";
import { PhotoPicker } from "@/components/PhotoPicker";
import { SeverityPicker } from "@/components/SeverityPicker";
import { TextField } from "@/components/TextField";
import {
  ApiError,
  errorMessage,
  newIdempotencyKey,
  retryMessage,
  upload,
  wakeServer,
  wakingMessage,
  withRetries,
} from "@/lib/api";
import { appendPhoto, type LocalPhoto } from "@/lib/photos";
import { inBulacan, isOpen, type Report, type Severity } from "@/lib/reports";
import { clearReportDraft, loadReportDraft, saveReportDraft } from "@/lib/reportDraft";
import { useSession } from "@/lib/session";
import { brand, mix, radius, severityColors, useTheme } from "@/theme";

const descriptionLimit = 600;

// GPS can take a while indoors; fall back to the last known position.
async function currentPosition(): Promise<MapPoint> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Location access is off. Allow it in your phone's Settings, or tap the map to drop a pin.");
  }
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 15000));
  const fix = await Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }), timeout]);
  const position = fix ?? (await Location.getLastKnownPositionAsync());
  if (!position) {
    throw new Error("Your location couldn't be found. Tap the map to drop a pin instead.");
  }
  return { lat: position.coords.latitude, lng: position.coords.longitude };
}

export default function ReportProblem() {
  const { colors } = useTheme();
  const { reports, upsertReport, user } = useSession();
  const userId = user?.id ?? null;
  const scroll = useRef<ScrollViewInstance>(null);

  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState<Severity | null>(null);
  const [description, setDescription] = useState("");
  const [point, setPoint] = useState<MapPoint | null>(null);
  const [panKey, setPanKey] = useState(0);
  const [road, setRoad] = useState("");
  const [location, setLocation] = useState("");
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [locating, setLocating] = useState(false);
  const [mapTouched, setMapTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // What the submit button is waiting for (waking the server, upload progress).
  const [progress, setProgress] = useState<string | null>(null);
  const [waking, setWaking] = useState(false);
  const [submitted, setSubmitted] = useState<Report | null>(null);
  // Sent with every attempt to submit this form, so a retry after a lost
  // answer returns the report already filed instead of a second one.
  const idempotencyKey = useRef(newIdempotencyKey());

  // The unsent report saved on this phone (lib/reportDraft): restored once,
  // then saved again as people fill in the form.
  const [draftReady, setDraftReady] = useState(false);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (!userId) {
      return;
    }
    let active = true;
    loadReportDraft(userId).then((draft) => {
      if (!active) {
        return;
      }
      if (draft) {
        setTitle(draft.title);
        setSeverity(draft.severity);
        setDescription(draft.description);
        setPoint(draft.point);
        setRoad(draft.road);
        setLocation(draft.location);
        setPhotos(draft.photos);
        setRestored(true);
        if (draft.point) {
          setPanKey((key) => key + 1);
        }
      }
      setDraftReady(true);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || !draftReady || submitted) {
      return;
    }
    const timer = setTimeout(() => {
      void saveReportDraft(userId, { title, severity, description, point, road, location, photos });
    }, 400);
    return () => clearTimeout(timer);
  }, [userId, draftReady, submitted, title, severity, description, point, road, location, photos]);

  // Wake the hosted server while people fill in the form.
  useEffect(() => {
    let active = true;
    const slow = setTimeout(() => active && setWaking(true), 2500);
    wakeServer()
      .catch(() => {})
      .finally(() => {
        clearTimeout(slow);
        if (active) setWaking(false);
      });
    return () => {
      active = false;
      clearTimeout(slow);
    };
  }, []);

  // Reports already open nearby, so people can see what's been filed.
  const markers = useMemo<MapMarker[]>(
    () =>
      reports
        .filter((report) => isOpen(report.status))
        .map((report) => ({
          id: report.id,
          lat: report.coordinates.lat,
          lng: report.coordinates.lng,
          color: brand.asphalt,
          kind: "dot",
          label: "Already reported: " + report.title,
        })),
    [reports],
  );

  const pin = point ? { ...point, color: severity ? severityColors[severity] : brand[700] } : null;
  const pinOutside = point ? !inBulacan(point.lat, point.lng) : false;

  function pick(next: MapPoint) {
    setPoint({ lat: Math.round(next.lat * 1e6) / 1e6, lng: Math.round(next.lng * 1e6) / 1e6 });
  }

  async function useMyLocation() {
    setLocating(true);
    setError(null);
    try {
      pick(await currentPosition());
      setPanKey((key) => key + 1);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLocating(false);
    }
  }

  function problem(): string | null {
    if (!title.trim()) return "Give the road damage a short title.";
    if (!severity) return "Choose how serious the damage is.";
    if (!description.trim()) return "Describe the damage.";
    if (!point) return "Drop a pin on the map or use your location.";
    if (pinOutside) return "This spot is outside Bulacan. Move the pin to the damaged road.";
    if (!road.trim()) return "Enter the road or street.";
    if (!location.trim()) return "Enter the barangay and municipality.";
    return null;
  }

  async function submit() {
    const found = problem();
    setDuplicateId(null);
    if (found) {
      setError(found);
      return;
    }
    setSending(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("title", title.trim());
      form.append("severity", severity as string);
      form.append("description", description.trim());
      form.append("road", road.trim());
      form.append("location", location.trim());
      form.append("latitude", String(point?.lat));
      form.append("longitude", String(point?.lng));
      for (const photo of photos) {
        await appendPhoto(form, "photos", photo);
      }
      const slow = setTimeout(() => setProgress(wakingMessage), 1500);
      try {
        await wakeServer();
      } finally {
        clearTimeout(slow);
      }
      const sendingText =
        "Sending your report" + (photos.length ? " and " + photos.length + (photos.length === 1 ? " photo" : " photos") : "");
      setProgress(sendingText + "…");
      const { report } = await withRetries(
        () =>
          upload<{ report: Report }>("/reports", form, {
            idempotencyKey: idempotencyKey.current,
            onProgress: (fraction) => setProgress(sendingText + "… " + Math.round(fraction * 100) + "%"),
          }),
        (attempt, of) => setProgress(retryMessage(attempt, of)),
      );
      idempotencyKey.current = newIdempotencyKey();
      if (userId) {
        void clearReportDraft(userId);
      }
      setRestored(false);
      upsertReport(report);
      setSubmitted(report);
      scroll.current?.scrollTo({ y: 0, animated: false });
    } catch (caught) {
      setError(errorMessage(caught));
      if (caught instanceof ApiError && typeof caught.data.duplicateId === "string") {
        setDuplicateId(caught.data.duplicateId);
      }
    } finally {
      setProgress(null);
      setSending(false);
    }
  }

  function reset() {
    setTitle("");
    setSeverity(null);
    setDescription("");
    setPoint(null);
    setRoad("");
    setLocation("");
    setPhotos([]);
    setError(null);
    setDuplicateId(null);
    setSubmitted(null);
    setRestored(false);
    idempotencyKey.current = newIdempotencyKey();
  }

  if (submitted) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.done, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.doneIcon, { backgroundColor: mix(colors.success, colors.surface, 0.14) }]}>
            <Icon name="check-circle" size={30} color={colors.success} />
          </View>
          <AppText variant="eyebrow">Report submitted</AppText>
          <AppText variant="display" style={styles.center}>
            {submitted.id}
          </AppText>
          <AppText tone="text2" style={styles.center}>
            Thank you. The Road Maintenance Office will review your report. Keep this ID to track its progress.
          </AppText>
          <Button
            label="View report"
            size="lg"
            style={styles.stretch}
            onPress={() => router.push({ pathname: "/reports/[id]", params: { id: submitted.id } })}
          />
          <Button label="Report another problem" variant="secondary" style={styles.stretch} onPress={reset} />
        </View>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!mapTouched}
      >
        {restored ? (
          <Notice message="Your unsent report was restored. Check it, then tap Submit report." />
        ) : null}
        <FormSection step={1} title="What's the problem?" text="Give the road damage a short title and tell us how serious it is.">
          <TextField
            label="Title"
            value={title}
            onChangeText={setTitle}
            maxLength={90}
            placeholder="e.g. Deep pothole near the public market"
          />
          <SeverityPicker value={severity} onChange={setSeverity} />
          <TextField
            label="Description"
            value={description}
            onChangeText={setDescription}
            maxLength={descriptionLimit}
            multiline
            placeholder="Describe the damage, its size, and anything that makes it dangerous."
            hint={description.length + " / " + descriptionLimit}
          />
        </FormSection>

        <FormSection step={2} title="Where is it?" text="Tap the map to drop a pin on the exact spot, or use your current location.">
          <View style={styles.pickerBar}>
            <View style={styles.pickerStatus}>
              <Icon
                name={point && !pinOutside ? "check-circle" : "map-pin"}
                size={16}
                color={point && !pinOutside ? colors.success : pinOutside ? colors.danger : colors.icon}
              />
              <AppText variant="caption" tone={pinOutside ? "danger" : "text2"} style={styles.flex}>
                {!point
                  ? "No location selected yet. Grey dots are reports already filed."
                  : pinOutside
                    ? "This spot is outside Bulacan. Move the pin to the damaged road."
                    : "Pinned at " + point.lat.toFixed(5) + ", " + point.lng.toFixed(5) + " · drag the pin to adjust"}
              </AppText>
            </View>
            <Button
              label="Use my location"
              variant="secondary"
              loading={locating}
              onPress={useMyLocation}
              icon={<Icon name="locate" size={18} color={colors.text} />}
            />
          </View>
          <MapView
            height={280}
            markers={markers}
            pin={pin}
            panKey={panKey}
            pickable
            onPick={pick}
            onMarkerPress={(id) => router.push({ pathname: "/reports/[id]", params: { id } })}
            onTouchingChange={setMapTouched}
          />
          <TextField
            label="Road or street"
            value={road}
            onChangeText={setRoad}
            maxLength={80}
            placeholder="e.g. MacArthur Highway"
          />
          <TextField
            label="Barangay and municipality"
            value={location}
            onChangeText={setLocation}
            maxLength={80}
            placeholder="e.g. Guinhawa, Malolos City"
          />
        </FormSection>

        <FormSection step={3} title="Add photos (optional)" text="Clear photos help the team verify the damage faster. Add up to five.">
          <PhotoPicker photos={photos} onChange={setPhotos} onError={setError} />
        </FormSection>

        <View style={[styles.submit, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {progress || waking ? <Notice tone="info" message={progress ?? wakingMessage} /> : null}
          {error ? <Notice tone="error" message={error} /> : null}
          {duplicateId ? (
            <Button
              label={"Open " + duplicateId}
              variant="secondary"
              onPress={() => router.push({ pathname: "/reports/[id]", params: { id: duplicateId } })}
            />
          ) : null}
          <View style={styles.privacy}>
            <Icon name="shield-check" size={16} color={colors.success} />
            <AppText variant="caption" tone="text2" style={styles.flex}>
              Your name stays private. Only the Road Maintenance Office sees who filed the report.
            </AppText>
          </View>
          <Button
            label="Submit report"
            size="lg"
            loading={sending}
            onPress={submit}
            icon={<Icon name="send" size={18} color="#FFFFFF" />}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  flex: { flex: 1 },
  pickerBar: { gap: 10 },
  pickerStatus: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  submit: { gap: 12, padding: 16, borderWidth: 1, borderRadius: radius.lg },
  privacy: { flexDirection: "row", gap: 8 },
  done: { alignItems: "center", gap: 10, padding: 24, borderWidth: 1, borderRadius: radius.lg },
  doneIcon: { width: 60, height: 60, alignItems: "center", justifyContent: "center", borderRadius: 30, marginBottom: 4 },
  center: { textAlign: "center" },
  stretch: { alignSelf: "stretch" },
});
