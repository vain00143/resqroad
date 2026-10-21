import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import type { Severity } from "@/lib/reports";
import { fonts, mix, radius, severityColors, useTheme, withAlpha } from "@/theme";

export function SeverityBadge({ severity }: { severity: Severity }) {
  const { colors } = useTheme();
  const tone = severityColors[severity];
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: mix(tone, colors.surface, 0.12), borderColor: withAlpha(tone, 0.3) },
      ]}
    >
      <View style={[styles.bar, { backgroundColor: tone }]} />
      <AppText variant="caption" style={styles.label} color={mix(tone, colors.text, 0.6)}>
        {severity}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 24,
    paddingLeft: 8,
    paddingRight: 10,
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  bar: { width: 3, height: 12, borderRadius: 2 },
  label: { fontFamily: fonts.semibold, fontSize: 12 },
});
