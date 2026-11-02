import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, type ScrollViewInstance } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { FeedbackSummary } from "@/components/FeedbackSummary";
import { Icon, type IconName } from "@/components/Icon";
import { KeyboardAware, useKeyboardHeight } from "@/components/KeyboardAware";
import { Notice } from "@/components/Notice";
import { PhotoGallery } from "@/components/PhotoGallery";
import { PhotoPicker } from "@/components/PhotoPicker";
import { StatusPill } from "@/components/StatusPill";
import { TextField } from "@/components/TextField";
import { ApiError, errorMessage, upload, wakeServer, wakingMessage } from "@/lib/api";
import {
  beforeAndAfter,
  commentPrompt,
  feedbackCommentMax,
  feedbackPhotosMax,
  feedbackTags,
  ratingLabels,
  repairOutcome,
  repairOutcomes,
  resolvedAt,
} from "@/lib/feedback";
import { formatShortDay } from "@/lib/format";
import { appendPhoto, takePendingPhotos, type LocalPhoto } from "@/lib/photos";
import { normalizeReportId, type RepairOutcomeValue, type Report } from "@/lib/reports";
import { useSession } from "@/lib/session";
import { brand, fonts, mix, radius, useTheme } from "@/theme";

type Draft = { rating: number; outcome: RepairOutcomeValue | null; tags: string[]; comment: string; photos: LocalPhoto[] };
type Question = "rating" | "outcome";

// Unsent answers stay put per report if the resident leaves before sending
// (until the app closes), as they do on the website.
const drafts = new Map<string, Draft>();
const emptyDraft: Draft = { rating: 0, outcome: null, tags: [], comment: "", photos: [] };

// Which form opened the camera (see addPhotos).
function cameraTarget(reportId: string) {
  return "feedback:" + reportId;
}

// The website's feedback dialog as a page that rises from the bottom: the
// report being rated (with before and after photos), then 1 to 5 stars,
// whether the road is fully repaired, quick tags, a comment, and up to three
// photos of the repaired road. Stars and the repair question are required.
// Feedback is sent once; afterwards this page shows what was sent.
export default function GiveFeedback() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  const params = useLocalSearchParams<{ id: string }>();
  const reportId = normalizeReportId(String(params.id)) ?? String(params.id);
  const { user, reports, loaded, refresh, upsertReport } = useSession();
  const report = reports.find((item) => item.id === reportId) ?? null;
  const scroll = useRef<ScrollViewInstance>(null);
  // Where the required questions are, to scroll to the first one left out.
  const questionY = useRef<Record<Question, number>>({ rating: 0, outcome: 0 });

  const [draft, setDraftState] = useState<Draft>(() => drafts.get(reportId) ?? emptyDraft);
  const [invalid, setInvalid] = useState<Partial<Record<Question, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // What sending is waiting for (waking the server, upload progress).
  const [progress, setProgress] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<number | null>(null);
  // True once this page sent the feedback: the thank-you replaces the form.
  const [sent, setSent] = useState(false);

  function setDraft(update: Partial<Draft>) {
    setError(null);
    setInvalid((current) => {
      const next = { ...current };
      if (update.rating !== undefined) {
        delete next.rating;
      }
      if (update.outcome !== undefined) {
        delete next.outcome;
      }
      return next;
    });
    setDraftState((current) => {
      const next = { ...current, ...update };
      drafts.set(reportId, next);
      return next;
    });
  }

  // Wakes the hosted server while the resident answers, and adds back a
  // camera photo that arrived after Android restarted the app.
  useEffect(() => {
    wakeServer().catch(() => {});
    let active = true;
    const room = feedbackPhotosMax - (drafts.get(reportId)?.photos.length ?? 0);
    takePendingPhotos(cameraTarget(reportId), room).then((photos) => {
      if (active && photos.length) {
        setDraftState((current) => {
          const next = { ...current, photos: [...current.photos, ...photos].slice(0, feedbackPhotosMax) };
          drafts.set(reportId, next);
          return next;
        });
      }
    });
    return () => {
      active = false;
    };
  }, [reportId]);

  function close() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace({ pathname: "/reports/[id]", params: { id: reportId } });
    }
  }

  async function submit() {
    if (sending) {
      return;
    }
    const problems: Partial<Record<Question, string>> = {};
    if (!draft.rating) {
      problems.rating = "Choose a star rating.";
    }
    if (!draft.outcome) {
      problems.outcome = "Tell us whether the road is fully repaired.";
    }
    if (problems.rating || problems.outcome) {
      setInvalid(problems);
      scroll.current?.scrollTo({ y: questionY.current[problems.rating ? "rating" : "outcome"] - 12, animated: true });
      return;
    }
    setSending(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("rating", String(draft.rating));
      form.append("outcome", draft.outcome as string);
      form.append("tags", draft.tags.join(","));
      form.append("comment", draft.comment.trim());
      for (const photo of draft.photos) {
        await appendPhoto(form, "photos", photo);
      }
      const slow = setTimeout(() => setProgress(wakingMessage), 1500);
      try {
        await wakeServer();
      } finally {
        clearTimeout(slow);
      }
      const count = draft.photos.length;
      const sendingText = "Sending your feedback" + (count ? " and " + count + (count === 1 ? " photo" : " photos") : "");
      setProgress(sendingText + "…");
      // Sent once: a feedback the server already has is refused (409), so
      // there's no retrying here.
      const { report: updated } = await upload<{ report: Report }>(
        "/reports/" + encodeURIComponent(reportId) + "/feedback",
        form,
        {
          onProgress: (fraction) => {
            setUploaded(fraction);
            setProgress(sendingText + "… " + Math.round(fraction * 100) + "%");
          },
        },
      );
      drafts.delete(reportId);
      upsertReport(updated);
      setSent(true);
    } catch (caught) {
      // Already sent (say, the answer to an earlier try was lost), or the
      // report changed: the latest copy shows where it stands.
      if (caught instanceof ApiError && caught.status === 409) {
        refresh().catch(() => {});
      }
      setError(errorMessage(caught));
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60);
    } finally {
      setProgress(null);
      setUploaded(null);
      setSending(false);
    }
  }

  const footerPadding = { paddingBottom: (keyboard ? 0 : insets.bottom) + 10 };

  if (!report || !user || report.reporterId !== user.id || report.status !== "resolved") {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Repair feedback" }} />
        {!report && !loaded ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <>
            <Notice
              tone="error"
              message={
                !report
                  ? "Report " + reportId + " isn't available."
                  : report.reporterId !== user?.id
                    ? "Only the resident who filed this report can give feedback on its repair."
                    : "You can give feedback once the report is resolved."
              }
            />
            <Button label="Back" variant="secondary" onPress={close} />
          </>
        )}
      </View>
    );
  }

  // Sent from this page, or earlier (from the website, say).
  if (report.feedback) {
    const feedback = report.feedback;
    const outcome = repairOutcome(feedback.outcome);
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ title: sent ? "Feedback sent" : "Your feedback" }} />
        <ScrollView ref={scroll} style={{ backgroundColor: colors.surface }} contentContainerStyle={styles.content}>
          <View style={styles.success}>
            <View style={[styles.successMark, { backgroundColor: mix(colors.success, colors.surface, 0.14) }]}>
              <Icon name="check" size={30} color={colors.success} />
            </View>
            <AppText variant="title" style={styles.centerText}>
              {sent ? "Thank you for your feedback!" : "You already gave feedback"}
            </AppText>
            <AppText tone="text2" style={styles.centerText}>
              {sent
                ? "It was sent to the Road Maintenance Office with " +
                  reportId +
                  ", and helps them check the quality of every repair."
                : "Sent " + formatShortDay(feedback.at) + ". Thank you. The Road Maintenance Office reads every response."}
            </AppText>
          </View>
          <FeedbackSummary feedback={feedback} />
          {outcome && outcome.value !== "fixed" ? (
            <Notice tone="warning" message="The office can see that the road still needs work, so they can follow up." />
          ) : null}
        </ScrollView>
        <View style={[styles.footer, footerPadding, { backgroundColor: colors.surface2, borderTopColor: colors.border }]}>
          <Button label="Done" onPress={close} style={styles.flex} />
        </View>
      </View>
    );
  }

  const pair = beforeAndAfter(report);
  const resolved = resolvedAt(report);

  return (
    <KeyboardAware style={styles.root}>
      <Stack.Screen options={{ title: "Repair feedback" }} />
      <ScrollView
        ref={scroll}
        style={{ backgroundColor: colors.surface }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.intro}>
          <View style={[styles.introIcon, { backgroundColor: colors.primarySoft }]}>
            <Icon name="star" size={20} color={colors.primarySoftText} />
          </View>
          <View style={styles.flex}>
            <AppText variant="title">How was the repair?</AppText>
            <AppText variant="caption" tone="text2">
              Rate the repair and tell the office whether the road is fully fixed. It takes less than a minute.
            </AppText>
          </View>
        </View>

        {/* The report being rated. */}
        <View style={[styles.report, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          <View style={styles.reportTags}>
            <AppText variant="eyebrow">{report.id}</AppText>
            <StatusPill status={report.status} />
          </View>
          <AppText variant="heading">{report.title}</AppText>
          <View style={styles.facts}>
            <Fact icon="map-pin" label="Location" value={report.road + " · " + report.location} />
            {resolved ? <Fact icon="calendar" label="Resolved" value={formatShortDay(resolved)} /> : null}
          </View>
          {pair.length ? (
            <PhotoGallery photos={pair.map((item) => item.photo)} captions={pair.map((item) => item.label)} />
          ) : null}
        </View>

        <View style={styles.question} onLayout={(event) => (questionY.current.rating = event.nativeEvent.layout.y)}>
          <AppText variant="label" tone="heading">
            Overall, how satisfied are you with the repair?
          </AppText>
          <StarPicker value={draft.rating} disabled={sending} onChange={(rating) => setDraft({ rating })} />
          <FieldError message={invalid.rating} />
        </View>

        <View style={styles.question} onLayout={(event) => (questionY.current.outcome = event.nativeEvent.layout.y)}>
          <AppText variant="label" tone="heading">
            Is the pothole fully repaired?
          </AppText>
          <View style={styles.outcomes} accessibilityRole="radiogroup">
            {repairOutcomes.map((outcome) => (
              <OutcomeOption
                key={outcome.value}
                value={outcome.value}
                selected={draft.outcome === outcome.value}
                invalid={Boolean(invalid.outcome)}
                disabled={sending}
                onPress={() => setDraft({ outcome: outcome.value })}
              />
            ))}
          </View>
          <FieldError message={invalid.outcome} />
        </View>

        <View style={styles.question}>
          <View>
            <AppText variant="label" tone="heading">
              What stood out?
            </AppText>
            <AppText variant="caption">Optional · pick any</AppText>
          </View>
          <View style={styles.tags}>
            {feedbackTags.map((tag) => {
              const chosen = draft.tags.includes(tag.value);
              // Kept in the list's order, praise first.
              const toggled = feedbackTags
                .map((item) => item.value)
                .filter((value) => (value === tag.value ? !chosen : draft.tags.includes(value)));
              return (
                <TagOption
                  key={tag.value}
                  label={tag.label}
                  positive={tag.positive}
                  selected={chosen}
                  disabled={sending}
                  onPress={() => setDraft({ tags: toggled })}
                />
              );
            })}
          </View>
        </View>

        <TextField
          label="Comments (optional)"
          value={draft.comment}
          onChangeText={(comment) => setDraft({ comment })}
          maxLength={feedbackCommentMax}
          multiline
          editable={!sending}
          placeholder={commentPrompt(draft.outcome)}
          hint={draft.comment.length + " / " + feedbackCommentMax}
        />

        <View style={styles.question}>
          <View>
            <AppText variant="label" tone="heading">
              Photos of the repaired road (optional)
            </AppText>
            <AppText variant="caption">Add up to {feedbackPhotosMax} photos of the finished repair.</AppText>
          </View>
          <PhotoPicker
            photos={draft.photos}
            max={feedbackPhotosMax}
            target={cameraTarget(reportId)}
            onChange={(photos) => setDraft({ photos })}
            onError={setError}
          />
        </View>

        {error ? <Notice tone="error" message={error} /> : null}
      </ScrollView>

      <View style={[styles.footer, footerPadding, { backgroundColor: colors.surface2, borderTopColor: colors.border }]}>
        {sending && progress ? (
          <View style={styles.footerNotice}>
            <Notice tone="info" message={progress} progress={uploaded} />
          </View>
        ) : null}
        <Button label="Cancel" variant="secondary" disabled={sending} onPress={close} style={styles.flex} />
        <Button
          label="Submit feedback"
          loading={sending}
          onPress={submit}
          icon={<Icon name="send" size={16} color="#FFFFFF" />}
          style={styles.submit}
        />
      </View>
    </KeyboardAware>
  );
}

// A label beside its value; the label stays level with the value's first
// line when a long place wraps.
function Fact({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <View style={styles.factLabel}>
        <Icon name={icon} size={14} />
        <AppText variant="caption">{label}</AppText>
      </View>
      <AppText variant="caption" tone="text" style={styles.factValue}>
        {value}
      </AppText>
    </View>
  );
}

function FieldError({ message }: { message?: string }) {
  const { colors } = useTheme();
  if (!message) {
    return null;
  }
  return (
    <View style={styles.error} accessibilityRole="alert">
      <Icon name="alert-circle" size={13} color={colors.danger} />
      <AppText variant="caption" tone="danger" style={styles.flex}>
        {message}
      </AppText>
    </View>
  );
}

// Five stars to tap, with what the chosen number means beside them.
function StarPicker({ value, disabled, onChange }: { value: number; disabled: boolean; onChange: (value: number) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.rating}>
      <View style={styles.starRow} accessibilityRole="radiogroup">
        {[1, 2, 3, 4, 5].map((star) => {
          const on = star <= value;
          return (
            <Pressable
              key={star}
              accessibilityRole="radio"
              accessibilityLabel={star + (star === 1 ? " star, " : " stars, ") + ratingLabels[star]}
              accessibilityState={{ checked: star === value, disabled }}
              disabled={disabled}
              hitSlop={2}
              onPress={() => onChange(star)}
              style={({ pressed }) => [styles.star, pressed && { backgroundColor: colors.pressed }]}
            >
              <Icon name="star" size={30} color={on ? brand[500] : colors.borderStrong} fill={on ? brand[500] : undefined} />
            </Pressable>
          );
        })}
      </View>
      <AppText variant="label" tone="text2" style={styles.ratingCaption}>
        {value ? ratingLabels[value] : "Choose 1 to 5 stars."}
      </AppText>
    </View>
  );
}

// One answer to "Is the pothole fully repaired?", in its status color once chosen.
function OutcomeOption({
  value,
  selected,
  invalid,
  disabled,
  onPress,
}: {
  value: RepairOutcomeValue;
  selected: boolean;
  invalid: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors, statusColors } = useTheme();
  const outcome = repairOutcome(value);
  if (!outcome) {
    return null;
  }
  const tone = statusColors[outcome.tone];
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={outcome.label + ": " + outcome.hint}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.outcome,
        {
          backgroundColor: selected ? mix(tone, colors.surface, 0.1) : pressed ? colors.surface3 : colors.surface,
          borderColor: selected ? tone : invalid ? mix(colors.danger, colors.borderStrong, 0.55) : colors.borderStrong,
        },
      ]}
    >
      <Icon name={outcome.icon} size={22} color={selected ? tone : colors.text3} />
      <View style={styles.flex}>
        <AppText variant="bodyStrong" tone="heading">
          {outcome.label}
        </AppText>
        <AppText variant="caption">{outcome.hint}</AppText>
      </View>
    </Pressable>
  );
}

// A quick tag to switch on or off: green for praise, red for problems.
function TagOption({
  label,
  positive,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  positive: boolean;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const tone = positive ? colors.success : colors.danger;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tag,
        {
          backgroundColor: selected ? mix(tone, colors.surface, 0.16) : pressed ? colors.surface3 : colors.surface,
          borderColor: selected ? tone : colors.borderStrong,
        },
      ]}
    >
      {selected ? <Icon name="check" size={14} color={tone} /> : null}
      <AppText variant="label" color={selected ? colors.heading : colors.text2} style={selected && styles.tagChosen}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, paddingBottom: 24, gap: 20 },
  center: { flex: 1, gap: 12, padding: 20, justifyContent: "center" },
  flex: { flex: 1 },
  centerText: { textAlign: "center" },
  intro: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  introIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.md },
  report: { gap: 8, padding: 12, borderWidth: 1, borderRadius: radius.lg },
  reportTags: { flexDirection: "row", alignItems: "center", gap: 8 },
  facts: { gap: 4 },
  fact: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  factLabel: { width: 84, flexDirection: "row", alignItems: "center", gap: 5, minHeight: 16 },
  factValue: { flex: 1, fontFamily: fonts.medium },
  question: { gap: 8 },
  error: { flexDirection: "row", alignItems: "center", gap: 5 },
  rating: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 10, rowGap: 2 },
  starRow: { flexDirection: "row" },
  star: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.sm },
  ratingCaption: { fontFamily: fonts.semibold },
  outcomes: { gap: 8 },
  outcome: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderRadius: radius.md,
  },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 34,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: radius.full,
  },
  tagChosen: { fontFamily: fonts.semibold },
  success: { alignItems: "center", gap: 8, paddingTop: 8 },
  successMark: { width: 64, height: 64, alignItems: "center", justifyContent: "center", borderRadius: 32, marginBottom: 4 },
  footer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerNotice: { width: "100%" },
  submit: { flex: 1.6 },
});
