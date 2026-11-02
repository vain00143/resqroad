import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { PhotoGallery } from "@/components/PhotoGallery";
import { feedbackTag, ratingLabels, repairOutcome, type FeedbackTag } from "@/lib/feedback";
import type { Feedback, RepairOutcomeValue } from "@/lib/reports";
import { brand, fonts, mix, radius, useTheme } from "@/theme";

// The website's rating stars: lit ones filled in Road Orange.
export function RatingStars({ rating, size = 18 }: { rating: number; size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stars} accessible accessibilityRole="image" accessibilityLabel={rating + " out of 5 stars"}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Icon
          key={star}
          name="star"
          size={size}
          color={star <= rating ? brand[500] : colors.borderStrong}
          fill={star <= rating ? brand[500] : undefined}
        />
      ))}
    </View>
  );
}

// "Fully repaired", "Partially repaired", or "Not repaired", as a pill in the
// answer's color. Nothing for ratings sent before the question was asked.
export function OutcomePill({ value }: { value: RepairOutcomeValue | null }) {
  const { colors, statusColors } = useTheme();
  const outcome = repairOutcome(value);
  if (!outcome) {
    return null;
  }
  const tone = statusColors[outcome.tone];
  return (
    <View style={[styles.pill, { backgroundColor: mix(tone, colors.surface, 0.12), borderColor: mix(tone, colors.surface, 0.22) }]}>
      <Icon name={outcome.icon} size={13} color={tone} />
      <AppText variant="caption" style={styles.pillText} color={mix(tone, colors.text, 0.55)} numberOfLines={1}>
        {outcome.summary}
      </AppText>
    </View>
  );
}

function TagLabel({ tag }: { tag: FeedbackTag }) {
  const { colors } = useTheme();
  const tone = tag.positive ? colors.success : colors.danger;
  return (
    <View style={[styles.tag, { backgroundColor: mix(tone, colors.surface, 0.08), borderColor: mix(tone, colors.border, 0.24) }]}>
      <Icon name={tag.positive ? "check" : "alert-circle"} size={12} color={tone} />
      <AppText variant="caption" style={styles.tagText} color={mix(tone, colors.text, 0.5)}>
        {tag.label}
      </AppText>
    </View>
  );
}

// A resident's feedback on a finished repair, like the website's: the stars,
// whether the road is fully repaired, the quick tags, the comment, and any
// photos of the repaired spot.
export function FeedbackSummary({ feedback }: { feedback: Feedback }) {
  const { colors } = useTheme();
  const tags = feedback.tags.map(feedbackTag).filter((tag): tag is FeedbackTag => tag !== null);
  return (
    <View style={[styles.box, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
      <View style={styles.head}>
        <View style={styles.rating}>
          <RatingStars rating={feedback.rating} />
          <AppText variant="bodyStrong" tone="heading">
            {feedback.rating} of 5 · {ratingLabels[feedback.rating]}
          </AppText>
        </View>
        <OutcomePill value={feedback.outcome} />
      </View>
      {tags.length ? (
        <View style={styles.tags} accessibilityLabel="Tags">
          {tags.map((tag) => (
            <TagLabel key={tag.value} tag={tag} />
          ))}
        </View>
      ) : null}
      {feedback.comment ? <AppText>{feedback.comment}</AppText> : null}
      {feedback.photos.length ? (
        <View style={styles.photos}>
          <AppText variant="label" tone="heading">
            Photos of the repaired road
          </AppText>
          <PhotoGallery photos={feedback.photos} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 12, padding: 12, borderWidth: 1, borderRadius: radius.lg },
  head: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 },
  rating: { flexDirection: "row", alignItems: "center", gap: 8 },
  stars: { flexDirection: "row", gap: 2 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 24,
    paddingLeft: 7,
    paddingRight: 9,
    borderWidth: 1,
    borderRadius: radius.full,
  },
  pillText: { fontFamily: fonts.semibold, fontSize: 11.5, lineHeight: 15 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 26,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderRadius: radius.full,
  },
  tagText: { fontFamily: fonts.medium },
  photos: { gap: 6 },
});
