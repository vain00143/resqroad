import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { formatDate } from "@/lib/format";
import { statusLabels, type HistoryEntry } from "@/lib/reports";
import { radius, useTheme } from "@/theme";

// Every decision on a report, newest first, with any note shown to the public
// (a rejection reason, or what the crew still needs to fix).
export function ReportTimeline({ history }: { history: HistoryEntry[] }) {
  const { colors, statusColors } = useTheme();
  const entries = [...history].reverse();
  return (
    <View style={styles.list}>
      {entries.map((entry, index) => {
        const tone = entry.status === "note" ? colors.icon : statusColors[entry.status];
        return (
          <View key={entry.at + index} style={styles.entry}>
            <View style={[styles.bar, { backgroundColor: tone }]} />
            <View style={styles.body}>
              <AppText variant="label" tone="heading">
                {entry.status === "note" ? "Note" : statusLabels[entry.status]}
              </AppText>
              <AppText variant="caption" tone="text2">
                {entry.description}
              </AppText>
              {entry.note ? (
                <View style={[styles.note, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                  <AppText variant="caption" tone="text">
                    “{entry.note}”
                  </AppText>
                </View>
              ) : null}
              <AppText variant="caption">
                {entry.actor} · {formatDate(entry.at)}
              </AppText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 14 },
  entry: { flexDirection: "row", gap: 12 },
  bar: { width: 3, borderRadius: 2 },
  body: { flex: 1, gap: 3 },
  note: { marginVertical: 4, padding: 10, borderWidth: 1, borderRadius: radius.sm },
});
