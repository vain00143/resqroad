import { useState, type ReactNode } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/AppText";
import { BuildInfo } from "@/components/BuildInfo";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Icon } from "@/components/Icon";
import { LiveBadge } from "@/components/LiveBadge";
import { Logotype } from "@/components/Logotype";
import { OfflineState } from "@/components/OfflineState";
import { ReportRow } from "@/components/ReportRow";
import type { Report } from "@/lib/reports";
import { useSession } from "@/lib/session";
import { radius, useTheme } from "@/theme";

type Stat = { label: string; value: number; color: string };

type Props = {
  subtitle: string;
  stats: Stat[];
  listTitle: string;
  reports: Report[];
  emptyText: string;
  // The main thing to do next, shown under the numbers.
  action?: ReactNode;
  comingNext?: string;
  // Where a list row leads; the report's page by default.
  onOpen?: (report: Report) => void;
};

// The signed-in home screen shared by residents and crews.
export function HomeScaffold({ subtitle, stats, listTitle, reports, emptyText, action, comingNext, onOpen }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, loaded, connection, refresh, signOut } = useSession();
  const [refreshing, setRefreshing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function pullToRefresh() {
    setRefreshing(true);
    await refresh().catch(() => {});
    setRefreshing(false);
  }

  const firstName = (user?.name ?? "").split(" ")[0];

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} tintColor={colors.accent} />}
      >
        <View style={styles.top}>
          <Logotype height={22} />
          <LiveBadge />
        </View>

        <View style={styles.greeting}>
          <AppText variant="display">Hi, {firstName}</AppText>
          <AppText tone="text2">{subtitle}</AppText>
        </View>

        {!loaded && connection === "offline" ? (
          <OfflineState />
        ) : (
          <>
            {connection === "offline" ? <OfflineState compact /> : null}
            <View style={styles.stats}>
              {stats.map((stat) => (
                <View key={stat.label} style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.statBar, { backgroundColor: stat.color }]} />
                  <AppText variant="title">{loaded ? stat.value : "–"}</AppText>
                  <AppText variant="caption" numberOfLines={2}>
                    {stat.label}
                  </AppText>
                </View>
              ))}
            </View>

            {action}

            <View style={styles.section}>
              <AppText variant="eyebrow">{listTitle}</AppText>
              {loaded && reports.length === 0 ? <AppText tone="text2">{emptyText}</AppText> : null}
              {reports.map((report) => (
                <ReportRow key={report.id} report={report} onPress={onOpen ? () => onOpen(report) : undefined} />
              ))}
            </View>

            {comingNext ? (
              <View style={[styles.next, { backgroundColor: colors.primarySoft }]}>
                <Icon name="sparkles" size={18} color={colors.primarySoftText} />
                <AppText variant="caption" color={colors.primarySoftText} style={styles.nextText}>
                  {comingNext}
                </AppText>
              </View>
            ) : null}
          </>
        )}

        <View style={[styles.account, { borderColor: colors.border }]}>
          <View style={styles.accountText}>
            <AppText variant="label" tone="heading">
              {user?.name}
            </AppText>
            <AppText variant="caption" numberOfLines={1}>
              {user?.email}
            </AppText>
          </View>
          <Button
            label="Log out"
            variant="secondary"
            onPress={() => setConfirming(true)}
            icon={<Icon name="log-out" size={16} color={colors.text} />}
          />
        </View>
        <BuildInfo />
      </ScrollView>

      <ConfirmDialog
        visible={confirming}
        icon="log-out"
        kicker="Account"
        title="Log out of ResQRoad?"
        message="You'll need to sign in again to get back to your account."
        confirmLabel="Log out"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          signOut();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 20 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  greeting: { gap: 4 },
  stats: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, gap: 2, padding: 12, borderWidth: 1, borderRadius: radius.lg, overflow: "hidden" },
  statBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3 },
  section: { gap: 10 },
  next: { flexDirection: "row", gap: 10, padding: 14, borderRadius: radius.md },
  nextText: { flex: 1 },
  account: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 20,
    borderTopWidth: 1,
  },
  accountText: { flex: 1 },
});
