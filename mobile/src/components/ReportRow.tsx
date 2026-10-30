import { useRouter } from "expo-router";
import { useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { SeverityBadge } from "@/components/SeverityBadge";
import { StatusPill } from "@/components/StatusPill";
import { canGiveFeedback } from "@/lib/feedback";
import { formatShortDay, timeAgo } from "@/lib/format";
import { photoUri } from "@/lib/photos";
import { statusLabels, type Report } from "@/lib/reports";
import { useSession } from "@/lib/session";
import { fonts, radius, useTheme } from "@/theme";

// A report in a list, like the website's report card: the first photo with
// the severity and age over it, then the ID, title, and place, and a footer
// with the status and date. Opens the report's page (crews open the job page).
// A resident's resolved report also gets Give feedback, as on the website.
export function ReportRow({ report, onPress }: { report: Report; onPress?: () => void }) {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useSession();
  const first = report.evidencePhotos[0];
  const uri = first ? photoUri(first) : null;
  const [failed, setFailed] = useState(false);
  const hasPhoto = Boolean(uri) && !failed;

  // Give feedback sits beside the card's own button, not inside it.
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          report.id + ": " + report.title + ", " + report.severity + " severity, " + statusLabels[report.status]
        }
        onPress={onPress ?? (() => router.push({ pathname: "/reports/[id]", params: { id: report.id } }))}
        style={({ pressed }) => pressed && { backgroundColor: colors.surface2 }}
      >
        <View style={[styles.media, { backgroundColor: colors.surface3 }]}>
          {hasPhoto && uri ? (
            <>
              <Image source={{ uri }} style={styles.photo} resizeMode="cover" onError={() => setFailed(true)} />
              <View style={styles.shade} pointerEvents="none" />
            </>
          ) : (
            <View style={styles.placeholder}>
              <Icon name="image" size={24} />
              <AppText variant="caption">No photo</AppText>
            </View>
          )}
          <View style={styles.severity}>
            <SeverityBadge severity={report.severity} />
          </View>
          <View style={styles.age}>
            <Icon name="clock" size={12} color={hasPhoto ? "#FFFFFF" : colors.text3} />
            <AppText
              variant="caption"
              color={hasPhoto ? "#FFFFFF" : colors.text3}
              numberOfLines={1}
              style={hasPhoto && styles.onPhoto}
            >
              {timeAgo(report.reportedAt)}
            </AppText>
          </View>
        </View>

        <View style={styles.body}>
          <AppText variant="eyebrow">{report.id}</AppText>
          <AppText variant="bodyStrong" tone="heading" numberOfLines={2}>
            {report.title}
          </AppText>
          <View style={styles.place}>
            <Icon name="map-pin" size={13} />
            <AppText variant="caption" numberOfLines={1} style={styles.flex}>
              {report.road} · {report.location}
            </AppText>
          </View>
        </View>

        <View style={[styles.foot, { borderTopColor: colors.border }]}>
          <StatusPill status={report.status} />
          <View style={styles.date}>
            <Icon name="calendar" size={13} />
            <AppText variant="caption">{formatShortDay(report.reportedAt)}</AppText>
          </View>
        </View>
      </Pressable>

      {/* The resident's own resolved report, until they rate the repair. */}
      {report.reporterId === user?.id && canGiveFeedback(report) ? (
        <View style={styles.feedback}>
          <Button
            label="Give feedback"
            variant="secondary"
            size="sm"
            accessibilityLabel={"Give feedback on the repair of " + report.id}
            onPress={() => router.push({ pathname: "/feedback/[id]", params: { id: report.id } })}
            icon={<Icon name="star" size={14} color={colors.text} />}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: "hidden", borderWidth: 1, borderRadius: radius.lg },
  media: { aspectRatio: 2, overflow: "hidden" },
  photo: { width: "100%", height: "100%" },
  // Darkens the bottom of the photo so the age stays readable, like the website.
  shade: {
    ...StyleSheet.absoluteFill,
    backgroundImage: "linear-gradient(to top, rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0) 50%)",
  },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  severity: { position: "absolute", top: 8, left: 8 },
  age: { position: "absolute", right: 10, bottom: 8, flexDirection: "row", alignItems: "center", gap: 4 },
  // Android measures shadowed text a little short, so leave it room to keep
  // "just now" on one line.
  onPhoto: {
    paddingRight: 3,
    fontFamily: fonts.medium,
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  body: { gap: 3, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10 },
  place: { flexDirection: "row", alignItems: "center", gap: 4 },
  flex: { flex: 1 },
  foot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  date: { flexDirection: "row", alignItems: "center", gap: 4 },
  feedback: { paddingHorizontal: 12, paddingBottom: 10 },
});
