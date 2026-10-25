import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";
import { SeverityBadge } from "@/components/SeverityBadge";
import { StatusPill } from "@/components/StatusPill";
import type { Report } from "@/lib/reports";

// The top of a report or job page: the ID, title, status and severity, and
// where the damage is. `children` adds more lines (see MetaLine).
export function ReportHeading({ report, children }: { report: Report; children?: ReactNode }) {
  return (
    <View style={styles.root}>
      <AppText variant="eyebrow">{report.id}</AppText>
      <AppText variant="title">{report.title}</AppText>
      <View style={styles.tags}>
        <StatusPill status={report.status} />
        <SeverityBadge severity={report.severity} />
      </View>
      <View style={styles.meta}>
        <MetaLine icon="map-pin">
          {report.road} · {report.location}
        </MetaLine>
        {children}
      </View>
    </View>
  );
}

export function MetaLine({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <View style={styles.line}>
      <Icon name={icon} size={14} />
      <AppText variant="caption" tone="text2" style={styles.flex}>
        {children}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 6, paddingTop: 16, paddingBottom: 14 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
  meta: { gap: 4, marginTop: 4 },
  line: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  flex: { flex: 1 },
});
