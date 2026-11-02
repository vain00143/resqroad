import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccountMenu } from "@/components/AccountMenu";
import { AppText } from "@/components/AppText";
import { BuildInfo } from "@/components/BuildInfo";
import { useTabBarSpace } from "@/components/FloatingTabBar";
import { Icon, type IconName } from "@/components/Icon";
import { Logotype } from "@/components/Logotype";
import { OfflineState } from "@/components/OfflineState";
import { ReportRow } from "@/components/ReportRow";
import type { Report } from "@/lib/reports";
import { useSession } from "@/lib/session";
import { fonts, mix, radius, useTheme } from "@/theme";

type Stat = { label: string; value: number; color: string; icon: IconName; caption: string };

type Props = {
  subtitle: string;
  stats: Stat[];
  listTitle: string;
  reports: Report[];
  emptyText: string;
  // Where a list card leads; the report's page by default.
  onOpen?: (report: Report) => void;
};

// The signed-in home screen shared by residents and crews: a white bar with
// the logo and the account menu, four numbers in a two-by-two grid (like the
// website's summary cards), then the latest reports as cards.
export function HomeScaffold({ subtitle, stats, listTitle, reports, emptyText, onOpen }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarSpace = useTabBarSpace();
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
      <View
        style={[
          styles.top,
          { paddingTop: insets.top + 10, backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <Logotype height={22} />
        <AccountMenu />
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace + 24 }]}
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
                  accessible
                  accessibilityLabel={stat.label + ": " + (loaded ? stat.value : "loading") + ". " + stat.caption}
                  style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.statHead}>
                    <AppText variant="caption" tone="text2" numberOfLines={1} style={styles.statLabel}>
                      {stat.label}
                    </AppText>
                    <View style={[styles.statIcon, { backgroundColor: mix(stat.color, colors.surface, 0.14) }]}>
                      <Icon name={stat.icon} size={14} color={stat.color} />
                    </View>
                  </View>
                  <AppText style={styles.statValue} tone="heading">
                    {loaded ? stat.value : "–"}
                  </AppText>
                  <AppText variant="caption" numberOfLines={2}>
                    {stat.caption}
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
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },
  greeting: { gap: 2 },
  // Two cards to a row.
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stat: { flexGrow: 1, flexBasis: "40%", gap: 2, padding: 12, borderWidth: 1, borderRadius: radius.md },
  statHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 2 },
  statLabel: { flex: 1, fontFamily: fonts.medium },
  statIcon: { width: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: radius.xs },
  statValue: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 27 },
  section: { gap: 10 },
});
