import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { OfflineState } from "@/components/OfflineState";
import { ReportRow } from "@/components/ReportRow";
import { isOpen, type Report } from "@/lib/reports";
import { useSession } from "@/lib/session";
import { radius, useTheme } from "@/theme";

const filters = {
  all: { label: "All", test: () => true },
  open: { label: "Open", test: (report: Report) => isOpen(report.status) },
  resolved: { label: "Resolved", test: (report: Report) => report.status === "resolved" },
  closed: { label: "Closed", test: (report: Report) => report.status === "rejected" || report.status === "duplicate" },
};
type Filter = keyof typeof filters;

export default function MyReports() {
  const { colors } = useTheme();
  const { user, reports, loaded, connection, refresh } = useSession();
  const [filter, setFilter] = useState<Filter>("all");
  const [refreshing, setRefreshing] = useState(false);

  const mine = useMemo(() => reports.filter((report) => report.reporterId === user?.id), [reports, user?.id]);
  const shown = mine.filter(filters[filter].test);

  async function pullToRefresh() {
    setRefreshing(true);
    await refresh().catch(() => {});
    setRefreshing(false);
  }

  return (
    <FlatList
      data={shown}
      keyExtractor={(report) => report.id}
      renderItem={({ item }) => <ReportRow report={item} />}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} tintColor={colors.accent} />}
      ListHeaderComponent={
        <View style={styles.header}>
          {connection === "offline" ? <OfflineState compact={loaded} /> : null}
          <View style={styles.chips}>
            {(Object.keys(filters) as Filter[]).map((key) => {
              const selected = key === filter;
              const count = mine.filter(filters[key].test).length;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setFilter(key)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selected ? colors.heading : colors.surface,
                      borderColor: selected ? colors.heading : colors.borderStrong,
                    },
                  ]}
                >
                  <AppText variant="label" color={selected ? colors.bg : colors.text}>
                    {filters[key].label} {loaded ? count : ""}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      }
      ListEmptyComponent={
        loaded ? (
          <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Icon name="clipboard-list" size={28} />
            <AppText variant="heading">
              {mine.length ? "No reports in this list" : "No reports yet"}
            </AppText>
            <AppText tone="text2" style={styles.centerText}>
              {mine.length
                ? "Try another filter."
                : "When you report road damage, it shows up here with every step of the repair."}
            </AppText>
            {mine.length ? null : (
              <Button label="Report a problem" onPress={() => router.push("/resident/report")} style={styles.stretch} />
            )}
          </View>
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40, gap: 10 },
  header: { gap: 12, marginBottom: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, minHeight: 36, justifyContent: "center", borderWidth: 1, borderRadius: radius.full },
  empty: { alignItems: "center", gap: 8, padding: 24, borderWidth: 1, borderRadius: radius.lg },
  centerText: { textAlign: "center" },
  stretch: { alignSelf: "stretch", marginTop: 8 },
});
