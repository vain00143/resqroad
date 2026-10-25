import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type ScrollViewInstance,
  type TextInputInstance,
} from "react-native";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Section } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { KeyboardAware } from "@/components/KeyboardAware";
import { MapView } from "@/components/map/MapView";
import type { MapMarker, MapPoint } from "@/components/map/mapHtml";
import { Notice } from "@/components/Notice";
import { PhotoGallery } from "@/components/PhotoGallery";
import { PhotoPicker } from "@/components/PhotoPicker";
import { SeverityBadge } from "@/components/SeverityBadge";
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
import { appendPhoto, photoLimits, takePendingPhotos, type LocalPhoto } from "@/lib/photos";
import { inBulacan, isOpen, type Report, type Severity } from "@/lib/reports";
import { clearReportDraft, loadReportDraft, saveReportDraft } from "@/lib/reportDraft";
import { useSession } from "@/lib/session";
import { brand, fonts, mix, radius, severityColors, useTheme } from "@/theme";

const descriptionLimit = 600;
const maxPhotos = photoLimits.report;

// The form's pages, one at a time: details, location, photos, then a review
// of everything with the Submit button.
const steps = [
  {
    label: "Details",
    title: "What's the problem?",
    text: "Give the road damage a short title and tell us how serious it is.",
  },
  {
    label: "Location",
    title: "Where is it?",
    text: "Tap the map to drop a pin on the exact spot, or use your current location.",
  },
  {
    label: "Photos",
    title: "Add photos",
    text: "Clear photos help the team verify the damage faster. Add at least one, up to five.",
  },
  {
    label: "Review",
    title: "Review your report",
    text: "Check everything before you send it. Tap Edit to change a part.",
  },
];
const reviewStep = steps.length - 1;

type Field = "title" | "severity" | "description" | "point" | "road" | "location" | "photos";
type Problem = { field: Field; message: string };

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
  const router = useRouter();
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const { reports, upsertReport, user } = useSession();
  const userId = user?.id ?? null;
  const scroll = useRef<ScrollViewInstance>(null);
  // Where each field sits on its page, to scroll a problem into view.
  const fieldY = useRef<Partial<Record<Field, number>>>({});
  const locationRef = useRef<TextInputInstance>(null);

  const [step, setStep] = useState(0);
  // Set by Edit on the review page: Next then goes straight back to it.
  const [returnToReview, setReturnToReview] = useState(false);
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
  // A field that needs fixing before the next page, shown beside that field.
  const [invalid, setInvalid] = useState<Problem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // What the submit button is waiting for (waking the server, upload progress).
  const [progress, setProgress] = useState<string | null>(null);
  // How much of the upload has been sent (0 to 1), for the progress bar.
  const [uploaded, setUploaded] = useState<number | null>(null);
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
    (async () => {
      const draft = await loadReportDraft(userId);
      // A camera photo that arrived after Android restarted the app.
      const recovered = await takePendingPhotos("report", maxPhotos - (draft?.photos.length ?? 0));
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
        setStep(Math.min(Math.max(0, draft.step ?? 0), reviewStep));
        setRestored(true);
        if (draft.point) {
          setPanKey((key) => key + 1);
        }
      }
      if (recovered.length) {
        setPhotos((current) => [...current, ...recovered].slice(0, maxPhotos));
        setStep(2);
        setRestored(true);
      }
      setDraftReady(true);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || !draftReady || submitted) {
      return;
    }
    const timer = setTimeout(() => {
      void saveReportDraft(userId, { title, severity, description, point, road, location, photos, step });
    }, 400);
    return () => clearTimeout(timer);
  }, [userId, draftReady, submitted, title, severity, description, point, road, location, photos, step]);

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

  const pinColor = severity ? severityColors[severity] : brand[700];
  const pin = point ? { ...point, color: pinColor } : null;
  const pinOutside = point ? !inBulacan(point.lat, point.lng) : false;
  // The review page's map: just this report's pin.
  const reviewMarkers = useMemo<MapMarker[]>(
    () => (point ? [{ id: "new", lat: point.lat, lng: point.lng, color: pinColor, kind: "pin" }] : []),
    [point, pinColor],
  );

  // Clears a field's problem as soon as it's changed.
  function edit<T>(field: Field, set: (value: T) => void) {
    return (value: T) => {
      set(value);
      setInvalid((current) => (current?.field === field ? null : current));
    };
  }

  function pick(next: MapPoint) {
    setPoint({ lat: Math.round(next.lat * 1e6) / 1e6, lng: Math.round(next.lng * 1e6) / 1e6 });
    setInvalid((current) => (current?.field === "point" ? null : current));
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

  // What still needs doing on a page before moving on.
  function problemOn(page: number): Problem | null {
    if (page === 0) {
      if (!title.trim()) return { field: "title", message: "Give the road damage a short title." };
      if (!severity) return { field: "severity", message: "Choose how serious the damage is." };
      if (!description.trim()) return { field: "description", message: "Describe the damage." };
    }
    if (page === 1) {
      if (!point) return { field: "point", message: "Drop a pin on the map or use your location." };
      if (pinOutside) return { field: "point", message: "This spot is outside Bulacan. Move the pin to the damaged road." };
      if (!road.trim()) return { field: "road", message: "Enter the road or street." };
      if (!location.trim()) return { field: "location", message: "Enter the barangay and municipality." };
    }
    if (page === 2 && photos.length === 0) {
      return { field: "photos", message: "Add at least one photo of the damage." };
    }
    return null;
  }

  // Brings the field that needs fixing into view (on a small screen it can be
  // below the fold, or on another page that has only just been laid out).
  useEffect(() => {
    if (!invalid) {
      return;
    }
    const timer = setTimeout(() => {
      const y = fieldY.current[invalid.field];
      if (y !== undefined) {
        scroll.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [invalid]);

  function at(field: Field) {
    return (event: LayoutChangeEvent) => {
      fieldY.current[field] = event.nativeEvent.layout.y;
    };
  }

  function goTo(page: number) {
    setStep(page);
    setError(null);
    setInvalid(null);
    setRestored(false);
  }

  // Each page starts at the top, once it has been laid out.
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  function next() {
    // After an edit from the review page, check the pages in between too.
    const last = returnToReview ? reviewStep - 1 : step;
    for (let page = step; page <= last; page++) {
      const found = problemOn(page);
      if (found) {
        if (page !== step) {
          goTo(page);
        }
        setInvalid(found);
        return;
      }
    }
    if (returnToReview) {
      setReturnToReview(false);
      goTo(reviewStep);
    } else {
      goTo(step + 1);
    }
  }

  function back() {
    setReturnToReview(false);
    goTo(step - 1);
  }

  function editPart(page: number) {
    setReturnToReview(true);
    goTo(page);
  }

  async function submit() {
    setDuplicateId(null);
    for (let page = 0; page < reviewStep; page++) {
      const found = problemOn(page);
      if (found) {
        setReturnToReview(true);
        goTo(page);
        setInvalid(found);
        return;
      }
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
        "Sending your report and " + photos.length + (photos.length === 1 ? " photo" : " photos");
      setProgress(sendingText + "…");
      const { report } = await withRetries(
        () =>
          upload<{ report: Report }>("/reports", form, {
            idempotencyKey: idempotencyKey.current,
            onProgress: (fraction) => {
              setUploaded(fraction);
              setProgress(sendingText + "… " + Math.round(fraction * 100) + "%");
            },
          }),
        (attempt, of) => {
          setUploaded(null);
          setProgress(retryMessage(attempt, of));
        },
      );
      idempotencyKey.current = newIdempotencyKey();
      if (userId) {
        void clearReportDraft(userId);
      }
      setRestored(false);
      upsertReport(report);
      setSubmitted(report);
    } catch (caught) {
      setError(errorMessage(caught));
      if (caught instanceof ApiError && typeof caught.data.duplicateId === "string") {
        setDuplicateId(caught.data.duplicateId);
      }
      // The message is under the review, which may be scrolled past.
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60);
    } finally {
      setProgress(null);
      setUploaded(null);
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
    setInvalid(null);
    setDuplicateId(null);
    setSubmitted(null);
    setRestored(false);
    setReturnToReview(false);
    setStep(0);
    idempotencyKey.current = newIdempotencyKey();
  }

  if (submitted) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.done, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.doneIcon, { backgroundColor: mix(colors.success, colors.surface, 0.14) }]}>
            <Icon name="check-circle" size={26} color={colors.success} />
          </View>
          <AppText variant="eyebrow">Report submitted</AppText>
          <AppText variant="display" style={styles.center}>
            {submitted.id}
          </AppText>
          <AppText tone="text2" style={styles.center}>
            Your report has been submitted. You can track its status in My reports.
          </AppText>
          <Button
            label="View report"
            style={styles.stretch}
            onPress={() => router.push({ pathname: "/reports/[id]", params: { id: submitted.id } })}
          />
          <Button label="Report another problem" variant="secondary" style={styles.stretch} onPress={reset} />
        </View>
      </ScrollView>
    );
  }

  const page = steps[step];
  const problem = (field: Field) => (invalid?.field === field ? invalid.message : null);

  return (
    <KeyboardAware style={styles.root}>
      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!mapTouched}
      >
        <StepIndicator step={step} />
        <View style={styles.intro}>
          <AppText variant="heading">{page.title}</AppText>
          <AppText variant="caption" tone="text2">
            {page.text}
          </AppText>
        </View>

        {restored ? <Notice message="Your unsent report was restored. Check it, then tap Submit report." /> : null}

        {step === 0 ? (
          <>
            <View onLayout={at("title")}>
              <TextField
                label="Title"
                value={title}
                onChangeText={edit("title", setTitle)}
                maxLength={90}
                placeholder="e.g. Deep pothole near the public market"
                error={problem("title")}
              />
            </View>
            <View onLayout={at("severity")}>
              <SeverityPicker value={severity} onChange={edit("severity", setSeverity)} error={problem("severity")} />
            </View>
            <View onLayout={at("description")}>
              <TextField
                label="Description"
                value={description}
                onChangeText={edit("description", setDescription)}
                maxLength={descriptionLimit}
                multiline
                placeholder="Describe the damage, its size, and anything that makes it dangerous."
                hint={description.length + " / " + descriptionLimit}
                error={problem("description")}
              />
            </View>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <View style={styles.pickerStatus} onLayout={at("point")}>
              <Icon
                name={point && !pinOutside ? "check-circle" : "map-pin"}
                size={15}
                color={point && !pinOutside ? colors.success : pinOutside || problem("point") ? colors.danger : colors.icon}
              />
              <AppText variant="caption" tone={pinOutside || problem("point") ? "danger" : "text2"} style={styles.flex}>
                {!point
                  ? (problem("point") ?? "No location selected yet. Grey dots are reports already filed.")
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
              icon={<Icon name="locate" size={16} color={colors.text} />}
            />
            <MapView
              height={Math.max(220, Math.round(height * 0.34))}
              markers={markers}
              pin={pin}
              panKey={panKey}
              pickable
              onPick={pick}
              onMarkerPress={(id) => router.push({ pathname: "/reports/[id]", params: { id } })}
              onTouchingChange={setMapTouched}
            />
            <View onLayout={at("road")}>
              <TextField
                label="Road or street"
                value={road}
                onChangeText={edit("road", setRoad)}
                maxLength={80}
                placeholder="e.g. MacArthur Highway"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => locationRef.current?.focus()}
                error={problem("road")}
              />
            </View>
            <View onLayout={at("location")}>
              <TextField
                ref={locationRef}
                label="Barangay and municipality"
                value={location}
                onChangeText={edit("location", setLocation)}
                maxLength={80}
                placeholder="e.g. Guinhawa, Malolos City"
                error={problem("location")}
              />
            </View>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <PhotoPicker
              photos={photos}
              max={maxPhotos}
              target="report"
              onChange={edit("photos", setPhotos)}
              onError={setError}
            />
            {problem("photos") ? (
              <View style={styles.inline} accessibilityRole="alert" onLayout={at("photos")}>
                <Icon name="alert-circle" size={13} color={colors.danger} />
                <AppText variant="caption" tone="danger">
                  {problem("photos")}
                </AppText>
              </View>
            ) : null}
          </>
        ) : null}

        {step === reviewStep ? (
          <View style={[styles.review, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Section first title="Details" aside={<EditLink part="details" onPress={() => editPart(0)} />}>
              <AppText variant="bodyStrong" tone="heading">
                {title.trim()}
              </AppText>
              {severity ? <SeverityBadge severity={severity} /> : null}
              <AppText variant="label" tone="text2">
                {description.trim()}
              </AppText>
            </Section>
            <Section title="Location" aside={<EditLink part="location" onPress={() => editPart(1)} />}>
              {/* A preview only: touches pass through so the page still scrolls. */}
              {point ? (
                <View pointerEvents="none">
                  <MapView height={140} zoom={16} center={point} markers={reviewMarkers} />
                </View>
              ) : null}
              <View style={styles.meta}>
                <Icon name="map-pin" size={14} />
                <AppText variant="label" tone="text2" style={styles.flex}>
                  {road.trim()} · {location.trim()}
                </AppText>
              </View>
              {point ? (
                <AppText variant="caption">
                  {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                </AppText>
              ) : null}
            </Section>
            <Section title="Photos" aside={<EditLink part="photos" onPress={() => editPart(2)} />}>
              <PhotoGallery photos={photos} />
            </Section>
          </View>
        ) : null}

        {step === reviewStep ? (
          <View style={styles.privacy}>
            <Icon name="shield-check" size={15} color={colors.success} />
            <AppText variant="caption" tone="text2" style={styles.flex}>
              Your name stays private. Only the Road Maintenance Office sees who filed the report.
            </AppText>
          </View>
        ) : null}
        {step === reviewStep && waking && !sending ? <Notice tone="info" message={wakingMessage} /> : null}
        {error ? <Notice tone="error" message={error} /> : null}
        {duplicateId ? (
          <Button
            label={"Open " + duplicateId}
            variant="secondary"
            onPress={() => router.push({ pathname: "/reports/[id]", params: { id: duplicateId } })}
          />
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        {/* What sending is waiting for, beside the button so it's always in view. */}
        {sending && progress ? (
          <View style={styles.footerNotice}>
            <Notice tone="info" message={progress} progress={uploaded} />
          </View>
        ) : null}
        {step > 0 ? (
          <Button
            label="Back"
            variant="secondary"
            disabled={sending}
            onPress={back}
            style={styles.backButton}
            accessibilityLabel={"Back to " + steps[step - 1].label}
          />
        ) : null}
        {step === reviewStep ? (
          <Button
            label="Submit report"
            loading={sending}
            onPress={submit}
            icon={<Icon name="send" size={16} color="#FFFFFF" />}
            style={styles.flex}
          />
        ) : (
          <Button
            label={returnToReview ? "Back to review" : "Next"}
            onPress={next}
            icon={<Icon name="arrow-right" size={16} color="#FFFFFF" />}
            style={styles.flex}
          />
        )}
      </View>
    </KeyboardAware>
  );
}

// "Step 2 of 4" with the four pages as a bar: done and current pages filled.
function StepIndicator({ step }: { step: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={styles.steps}
      accessibilityRole="progressbar"
      accessibilityLabel={"Step " + (step + 1) + " of " + steps.length + ": " + steps[step].label}
    >
      {steps.map((item, index) => (
        <View key={item.label} style={styles.stepItem}>
          <View style={[styles.stepBar, { backgroundColor: index <= step ? colors.accent : colors.border }]} />
          <AppText
            variant="caption"
            tone={index === step ? "heading" : index < step ? "text2" : "text3"}
            numberOfLines={1}
            // Four labels share one row, so they grow less with large text.
            maxFontSizeMultiplier={1.15}
            style={index === step && styles.stepCurrent}
          >
            {index + 1}. {item.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

function EditLink({ part, onPress }: { part: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={"Edit " + part} hitSlop={10} onPress={onPress}>
      <AppText variant="label" tone="link">
        Edit
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, paddingBottom: 24, gap: 14 },
  flex: { flex: 1 },
  intro: { gap: 2 },
  steps: { flexDirection: "row", gap: 6 },
  stepItem: { flex: 1, gap: 5 },
  stepBar: { height: 3, borderRadius: 2 },
  stepCurrent: { fontFamily: fonts.semibold },
  pickerStatus: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  inline: { flexDirection: "row", alignItems: "center", gap: 5 },
  review: { paddingHorizontal: 14, borderWidth: 1, borderRadius: radius.lg },
  meta: { flexDirection: "row", alignItems: "center", gap: 6 },
  privacy: { flexDirection: "row", gap: 8 },
  footer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerNotice: { width: "100%" },
  backButton: { minWidth: 96 },
  done: { alignItems: "center", gap: 10, padding: 20, borderWidth: 1, borderRadius: radius.lg },
  doneIcon: { width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: 26, marginBottom: 2 },
  center: { textAlign: "center" },
  stretch: { alignSelf: "stretch" },
});
