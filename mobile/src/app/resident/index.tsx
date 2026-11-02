import { HomeScaffold } from "@/components/HomeScaffold";
import { isOpen, type ReportStatus } from "@/lib/reports";
import { useSession } from "@/lib/session";
import { useTheme } from "@/theme";

// Waiting for the office or a crew, and being repaired (or checked after the
// repair): each open report counts in one of the two.
const waiting: ReportStatus[] = ["submitted", "under_review", "verified", "assigned"];
const repairing: ReportStatus[] = ["in_progress", "repair_submitted"];

export default function ResidentHome() {
  const { colors, statusColors } = useTheme();
  const { user, reports } = useSession();
  const mine = reports.filter((report) => report.reporterId === user?.id);
  // The three newest reports still being handled; fixed and closed ones are
  // in My reports.
  const latest = mine
    .filter((report) => isOpen(report.status))
    .sort((first, second) => Date.parse(second.reportedAt) - Date.parse(first.reportedAt))
    .slice(0, 3);

  return (
    <HomeScaffold
      subtitle="Resident account"
      stats={[
        {
          label: "My reports",
          value: mine.length,
          color: colors.accent,
          icon: "clipboard-list",
          caption: "All you've filed",
        },
        {
          label: "Open",
          value: mine.filter((report) => waiting.includes(report.status)).length,
          color: statusColors.under_review,
          icon: "clock",
          caption: "Waiting for repair",
        },
        {
          label: "In progress",
          value: mine.filter((report) => repairing.includes(report.status)).length,
          color: statusColors.in_progress,
          icon: "wrench",
          caption: "Being repaired",
        },
        {
          label: "Resolved",
          value: mine.filter((report) => report.status === "resolved").length,
          color: statusColors.resolved,
          icon: "check-circle",
          caption: "Fixed and verified",
        },
      ]}
      listTitle="My latest reports"
      reports={latest}
      emptyText={
        mine.length
          ? "None of your reports are open right now. Find them all in My reports."
          : "You haven't reported any road damage yet."
      }
    />
  );
}
