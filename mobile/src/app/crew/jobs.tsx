import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Chips } from "@/components/Chips";
import { Icon } from "@/components/Icon";
import { OfflineState } from "@/components/OfflineState";
import { ReportRow } from "@/components/ReportRow";
import { inTab, jobTabs, myJobs, type JobTab } from "@/lib/jobs";
import { useSession } from "@/lib/session";
import { radius, useTheme } from "@/theme";

// The website's empty-list wording for each tab.
const emptyText: Record<JobTab, { title: string; text: string }> = {
  active: { title: "No active jobs", text: "Nice work. Check the other tabs for submitted and completed repairs." },
  review: { title: "Nothing awaiting review", text: "Repairs you submit appear here until an administrator verifies them." },
  done: { title: "No completed repairs yet", text: "Repairs verified by an administrator are listed here." },
  all: { title: "No jobs assigned yet", text: "When an administrator assigns a verified report, it will appear here." },
};

export default function MyJobs() {
  const { colors } = useTheme();
  const { user, reports, loaded, connection, refresh } = useSession();
  const [tab, setTab] = useState<JobTab>("active");
  const [refreshing, setRefreshing] = useState(false);

  const jobs = useMemo(() => myJobs(reports, user?.id), [reports, user?.id]);
  const shown = jobs.filter((report) => inTab(report, tab));
  const empty = jobs.length === 0 ? emptyText.all : emptyText[tab];

  async function pullToRefresh() {
    setRefreshing(true);
    await refresh().catch(() => {});
    setRefreshing(false);
  }

  return (
    <FlatList
      data={shown}
      keyExtractor={(report) => report.id}
      renderItem={({ item }) => (
        <ReportRow report={item} onPress={() => router.push({ pathname: "/jobs/[id]", params: { id: item.id } })} />
      )}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} tintColor={colors.accent} />}
      ListHeaderComponent={
        <View style={styles.header}>
          {connection === "offline" ? <OfflineState compact={loaded} /> : null}
          <Chips
            options={(Object.keys(jobTabs) as JobTab[]).map((key) => ({
              key,
              label: jobTabs[key].label,
              count: loaded ? jobs.filter((report) => inTab(report, key)).length : undefined,
            }))}
            value={tab}
            onChange={setTab}
          />
        </View>
      }
      ListEmptyComponent={
        loaded ? (
          <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Icon name="inbox" size={28} />
            <AppText variant="heading">{empty.title}</AppText>
            <AppText tone="text2" style={styles.centerText}>
              {empty.text}
            </AppText>
          </View>
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40, gap: 10 },
  header: { gap: 12, marginBottom: 4 },
  empty: { alignItems: "center", gap: 8, padding: 24, borderWidth: 1, borderRadius: radius.lg },
  centerText: { textAlign: "center" },
});
