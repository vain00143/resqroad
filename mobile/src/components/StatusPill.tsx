import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { statusLabels, type ReportStatus } from "@/lib/reports";
import { fonts, labelColor, radius, useTheme } from "@/theme";

// A report's workflow status as a solid label, like the website's severity
// labels: white text on the status color.
export function StatusPill({ status }: { status: ReportStatus }) {
  const { statusColors } = useTheme();
  return (
    <View style={[styles.label, { backgroundColor: labelColor(statusColors[status]) }]}>
      <AppText variant="caption" style={styles.text} color="#FFFFFF" numberOfLines={1}>
        {statusLabels[status]}
      </AppText>
    </View>
  );
}

export const labelStyles = StyleSheet.create({
  label: {
    alignSelf: "flex-start",
    justifyContent: "center",
    minHeight: 20,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  text: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.1 },
});

const styles = labelStyles;
