import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { formatDate } from "@/lib/format";
import { statusLabels, workflow, type Report, type ReportStatus } from "@/lib/reports";
import { useTheme, withAlpha } from "@/theme";

type State = "done" | "current" | "upcoming";

// Where a report is in the workflow, one step per line, like the website's
// report journey: done steps in orange with a check, the current step as a
// white marker with an orange center, and the steps still to come outlined.
// Rejected and duplicate reports end after their last step.
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

  function stateOf(index: number): State {
    if (index < currentIndex) return "done";
    if (index > currentIndex) return "upcoming";
    // A resolved report has finished every step.
    return report.status === "resolved" ? "done" : "current";
  }

  return (
    <View accessibilityLabel="Report progress">
      {steps.map((status, index) => {
        const state = stateOf(index);
        const last = index === steps.length - 1;
        // The closing step of a rejected or duplicate report keeps its own color.
        const center = closed && last ? statusColors[status] : colors.accent;
        return (
          <View
            key={status}
            style={styles.step}
            accessibilityLabel={
              statusLabels[status] + (state === "current" ? ", current step" : state === "done" ? ", done" : ", not reached")
            }
          >
            <View style={styles.rail}>
              {state === "done" ? (
                <View style={[styles.marker, { backgroundColor: colors.accent }]}>
                  <Icon name="check" size={11} color="#FFFFFF" />
                </View>
              ) : state === "current" ? (
                <View style={[styles.marker, styles.current, { borderColor: withAlpha(center, 0.35), shadowColor: center }]}>
                  <View style={[styles.center, { backgroundColor: center }]} />
                </View>
              ) : (
                <View style={[styles.marker, styles.upcoming, { borderColor: colors.borderStrong }]} />
              )}
              {last ? null : (
                <View
                  style={[
                    styles.line,
                    index < currentIndex
                      ? { width: 2, backgroundColor: colors.accent }
                      : { width: 1, backgroundColor: colors.borderStrong },
                  ]}
                />
              )}
            </View>
            <View style={[styles.text, last && styles.lastText]}>
              <AppText
                variant={state === "current" ? "bodyStrong" : "label"}
                tone={state === "upcoming" ? "text3" : "heading"}
                style={styles.label}
              >
                {statusLabels[status]}
              </AppText>
              {state !== "upcoming" && reachedAt.has(status) ? (
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
  marker: { width: 20, height: 20, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  current: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    backgroundColor: "#FFFFFF",
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  center: { width: 9, height: 9, borderRadius: 5 },
  upcoming: { borderWidth: 1.5 },
  line: { flex: 1, minHeight: 10, marginVertical: 3, borderRadius: 1 },
  text: { flex: 1, paddingBottom: 12, minHeight: 34 },
  lastText: { paddingBottom: 0, minHeight: 0 },
  label: { lineHeight: 20 },
});
