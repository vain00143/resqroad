import { router } from "expo-router";

import { Button } from "@/components/Button";
import { HomeScaffold } from "@/components/HomeScaffold";
import { Icon } from "@/components/Icon";
import { isOpen } from "@/lib/reports";
import { useSession } from "@/lib/session";
import { useTheme } from "@/theme";

export default function ResidentHome() {
  const { colors, statusColors } = useTheme();
  const { user, reports } = useSession();
  const mine = reports.filter((report) => report.reporterId === user?.id);

  return (
    <HomeScaffold
      subtitle="Resident account"
      stats={[
        { label: "My reports", value: mine.length, color: colors.accent },
        { label: "Open", value: mine.filter((report) => isOpen(report.status)).length, color: statusColors.in_progress },
        { label: "Resolved", value: mine.filter((report) => report.status === "resolved").length, color: statusColors.resolved },
      ]}
      action={
        <Button
          label="Report a problem"
          size="lg"
          onPress={() => router.push("/resident/report")}
          icon={<Icon name="camera" size={18} color="#FFFFFF" />}
        />
      }
      listTitle="My latest reports"
      reports={mine.slice(0, 3)}
      emptyText="You haven't reported any road damage yet."
    />
  );
}
