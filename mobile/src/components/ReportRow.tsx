import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { SeverityBadge } from "@/components/SeverityBadge";
import { StatusPill } from "@/components/StatusPill";
import type { Report } from "@/lib/reports";
import { radius, useTheme } from "@/theme";

export function ReportRow({ report }: { report: Report }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <AppText variant="eyebrow">{report.id}</AppText>
      <AppText variant="bodyStrong" tone="heading" numberOfLines={2}>
        {report.title}
      </AppText>
      <AppText variant="caption" numberOfLines={1}>
        {report.road} · {report.location}
      </AppText>
      <View style={styles.tags}>
        <StatusPill status={report.status} />
        <SeverityBadge severity={report.severity} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 4, padding: 14, borderWidth: 1, borderRadius: radius.lg },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
});
