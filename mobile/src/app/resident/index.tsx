import { HomeScaffold } from "@/components/HomeScaffold";
import { useSession } from "@/lib/session";
import { useTheme } from "@/theme";

export default function ResidentHome() {
  const { colors, statusColors } = useTheme();
  const { user, reports } = useSession();
  const mine = reports.filter((report) => report.reporterId === user?.id);
  const closed = ["resolved", "rejected", "duplicate"];

  return (
    <HomeScaffold
      subtitle="Resident account"
      stats={[
        { label: "My reports", value: mine.length, color: colors.accent },
        { label: "Open", value: mine.filter((report) => !closed.includes(report.status)).length, color: statusColors.in_progress },
        { label: "Resolved", value: mine.filter((report) => report.status === "resolved").length, color: statusColors.resolved },
      ]}
      listTitle="My latest reports"
      reports={mine.slice(0, 3)}
      emptyText="You haven't reported any road damage yet."
      comingNext="Reporting with camera and GPS, My reports, and report tracking come in the next step."
    />
  );
}
