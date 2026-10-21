import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { statusLabels, type ReportStatus } from "@/lib/reports";
import { fonts, mix, radius, useTheme, withAlpha } from "@/theme";

// A report's workflow status, tinted the same way as the website's `.pill`.
export function StatusPill({ status }: { status: ReportStatus }) {
  const { colors, statusColors } = useTheme();
  const tone = statusColors[status];
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: mix(tone, colors.surface, 0.12), borderColor: withAlpha(tone, 0.22) },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: tone }]} />
      <AppText variant="caption" style={styles.label} color={mix(tone, colors.text, 0.55)}>
        {statusLabels[status]}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 24,
    paddingLeft: 8,
    paddingRight: 10,
    borderWidth: 1,
    borderRadius: radius.full,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  label: { fontFamily: fonts.semibold, fontSize: 12 },
});
