import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { formatDate } from "@/lib/format";
import { statusLabels, workflow, type Report, type ReportStatus } from "@/lib/reports";
import { useTheme } from "@/theme";

// Where a report is in the workflow, one step per line, like the website's
// report journey. Rejected and duplicate reports end after their last step.
export function ReportProgress({ report }: { report: Report }) {
  const { colors, statusColors } = useTheme();

  // When each step was last reached.
  const reachedAt = new Map<ReportStatus, string>();
  report.history.forEach((entry) => {
    if (entry.status !== "note") {
      reachedAt.set(entry.status, entry.at);
    }
  });

  const closed = report.status === "rejected" || report.status === "duplicate";
  const lastIndex = closed
    ? Math.max(0, ...workflow.map((status, index) => (reachedAt.has(status) ? index : 0)))
    : workflow.indexOf(report.status);
  const steps: ReportStatus[] = closed ? [...workflow.slice(0, lastIndex + 1), report.status] : workflow;
  const currentIndex = closed ? steps.length - 1 : lastIndex;

  return (
    <View>
      {steps.map((status, index) => {
        const done = index <= currentIndex;
        const current = index === currentIndex;
        const tone = done ? statusColors[status] : colors.borderStrong;
        const last = index === steps.length - 1;
        return (
          <View key={status} style={styles.step}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  { borderColor: tone, backgroundColor: done ? tone : colors.surface },
                  current && styles.currentDot,
                ]}
              >
                {done && !current ? <Icon name="check" size={11} color="#FFFFFF" /> : null}
              </View>
              {last ? null : (
                <View style={[styles.line, { backgroundColor: index < currentIndex ? tone : colors.border }]} />
              )}
            </View>
            <View style={[styles.text, last && styles.lastText]}>
              <AppText variant={current ? "bodyStrong" : "label"} tone={done ? "heading" : "text3"}>
                {statusLabels[status]}
              </AppText>
              {done && reachedAt.has(status) ? (
                <AppText variant="caption">{formatDate(reachedAt.get(status))}</AppText>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: "row", gap: 12 },
  rail: { alignItems: "center", width: 22 },
  dot: { width: 18, height: 18, marginTop: 2, alignItems: "center", justifyContent: "center", borderWidth: 2, borderRadius: 9 },
  currentDot: { width: 22, height: 22, marginTop: 0, borderRadius: 11, borderWidth: 5 },
  line: { flex: 1, width: 2, marginVertical: 2, minHeight: 16 },
  text: { flex: 1, paddingBottom: 14 },
  lastText: { paddingBottom: 0 },
});
