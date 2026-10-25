import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { formatDate } from "@/lib/format";
import { statusLabels, type HistoryEntry } from "@/lib/reports";
import { radius, useTheme } from "@/theme";

// Every decision on a report, newest first, with any note shown to the public
// (a rejection reason, or what the crew still needs to fix). `byViewer` is
// true when the person looking filed the report: the server words the first
// entry for staff ("Report received from a citizen."), so it's shown as
// their own submission instead. The server names the resident on that entry;
// like the website, the app never shows it to anyone else (crews, or anyone
// tracking the report).
export function ReportTimeline({ history, byViewer = false }: { history: HistoryEntry[]; byViewer?: boolean }) {
  const { colors } = useTheme();
  const firstSubmitted = history.findIndex((entry) => entry.status === "submitted");
  const entries = history.map((entry, index) => ({ entry, own: byViewer && index === firstSubmitted })).reverse();

  return (
    <View>
      {entries.map(({ entry, own }, index) => (
        <View
          key={entry.at + index}
          style={[
            styles.entry,
            index === 0 ? styles.first : { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
          ]}
        >
          <AppText variant="label" tone="heading">
            {entry.status === "note" ? "Note" : statusLabels[entry.status]}
          </AppText>
          <AppText variant="caption" tone="text2">
            {own ? "You submitted this report. Track its status in My reports." : entry.description}
          </AppText>
          {entry.note ? (
            <View style={[styles.note, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
              <AppText variant="caption" tone="text">
                “{entry.note}”
              </AppText>
            </View>
          ) : null}
          <AppText variant="caption">
            {own ? "You · " : entry.status === "submitted" || !entry.actor ? "" : entry.actor + " · "}
            {formatDate(entry.at)}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  entry: { gap: 2, paddingVertical: 10 },
  first: { paddingTop: 0 },
  note: { marginVertical: 4, padding: 8, borderWidth: 1, borderRadius: radius.sm },
});
