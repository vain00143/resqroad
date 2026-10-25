import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccountMenu } from "@/components/AccountMenu";
import { AppText } from "@/components/AppText";
import { BuildInfo } from "@/components/BuildInfo";
import { LiveBadge } from "@/components/LiveBadge";
import { Logotype } from "@/components/Logotype";
import { OfflineState } from "@/components/OfflineState";
import { ReportRow } from "@/components/ReportRow";
import type { Report } from "@/lib/reports";
import { useSession } from "@/lib/session";
import { fonts, radius, useTheme } from "@/theme";

type Stat = { label: string; value: number; color: string };

type Props = {
  subtitle: string;
  stats: Stat[];
  listTitle: string;
  reports: Report[];
  emptyText: string;
  // Where a list card leads; the report's page by default.
  onOpen?: (report: Report) => void;
};

// The signed-in home screen shared by residents and crews: the logo and the
// account menu, three numbers, then the latest reports as cards.
export function HomeScaffold({ subtitle, stats, listTitle, reports, emptyText, onOpen }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, loaded, connection, refresh } = useSession();
  const [refreshing, setRefreshing] = useState(false);

  async function pullToRefresh() {
    setRefreshing(true);
    await refresh().catch(() => {});
    setRefreshing(false);
  }

  const firstName = (user?.name ?? "").split(" ")[0];

  return (
    <View style={styles.root}>
      <View style={[styles.top, { paddingTop: insets.top + 10 }]}>
        <Logotype height={18} />
        <View style={styles.topRight}>
          <LiveBadge />
          <AccountMenu />
        </View>
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 24 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} tintColor={colors.accent} />}
      >
        <View style={styles.greeting}>
          <AppText variant="display">Hi, {firstName}</AppText>
          <AppText variant="caption" tone="text2">
            {subtitle}
          </AppText>
        </View>

        {!loaded && connection === "offline" ? (
          <OfflineState />
        ) : (
          <>
            {connection === "offline" ? <OfflineState compact /> : null}
            <View style={styles.stats}>
              {stats.map((stat) => (
                <View
                  key={stat.label}
                  accessibilityLabel={stat.label + ": " + (loaded ? stat.value : "loading")}
                  style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={[styles.statBar, { backgroundColor: stat.color }]} />
                  <AppText style={styles.statValue} tone="heading">
                    {loaded ? stat.value : "–"}
                  </AppText>
                  <AppText variant="caption" numberOfLines={2}>
                    {stat.label}
                  </AppText>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <AppText variant="eyebrow">{listTitle}</AppText>
              {loaded && reports.length === 0 ? (
                <AppText variant="label" tone="text2">
                  {emptyText}
                </AppText>
              ) : null}
              {reports.map((report) => (
                <ReportRow key={report.id} report={report} onPress={onOpen ? () => onOpen(report) : undefined} />
              ))}
            </View>
          </>
        )}

        <BuildInfo />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  topRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  content: { paddingHorizontal: 16, paddingTop: 6, gap: 16 },
  greeting: { gap: 2 },
  stats: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, paddingVertical: 8, paddingLeft: 11, paddingRight: 8, borderWidth: 1, borderRadius: radius.md, overflow: "hidden" },
  statBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3 },
  statValue: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 22 },
  section: { gap: 10 },
});
