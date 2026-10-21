import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { SeverityBadge } from "@/components/SeverityBadge";
import { StatusPill } from "@/components/StatusPill";
import { timeAgo } from "@/lib/format";
import type { Report } from "@/lib/reports";
import { radius, useTheme } from "@/theme";

// A report in a list; opens the report's page (crews open the job page).
export function ReportRow({ report, onPress }: { report: Report; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={report.id + ", " + report.title}
      onPress={onPress ?? (() => router.push({ pathname: "/reports/[id]", params: { id: report.id } }))}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? colors.surface3 : colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.top}>
        <AppText variant="eyebrow">{report.id}</AppText>
        <AppText variant="caption">{timeAgo(report.reportedAt)}</AppText>
      </View>
      <View style={styles.titleRow}>
        <AppText variant="bodyStrong" tone="heading" numberOfLines={2} style={styles.title}>
          {report.title}
        </AppText>
        <Icon name="chevron-right" size={18} />
      </View>
      <AppText variant="caption" numberOfLines={1}>
        {report.road} · {report.location}
      </AppText>
      <View style={styles.tags}>
        <StatusPill status={report.status} />
        <SeverityBadge severity={report.severity} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { gap: 4, padding: 14, borderWidth: 1, borderRadius: radius.lg },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
});
