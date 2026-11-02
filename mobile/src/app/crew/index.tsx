import { useRouter } from "expo-router";

import { HomeScaffold } from "@/components/HomeScaffold";
import { inTab, myJobs } from "@/lib/jobs";
import { useSession } from "@/lib/session";
import { useTheme } from "@/theme";

export default function CrewHome() {
  const router = useRouter();
  const { statusColors } = useTheme();
  const { user, reports } = useSession();
  const jobs = myJobs(reports, user?.id);
  const active = jobs.filter((report) => inTab(report, "active"));

  return (
    <HomeScaffold
      subtitle={(user?.team || "Maintenance crew") + " · Maintenance"}
      stats={[
        {
          label: "To start",
          value: jobs.filter((report) => report.status === "assigned").length,
          color: statusColors.assigned,
          icon: "clipboard-list",
          caption: "Not started yet",
        },
        {
          label: "In progress",
          value: jobs.filter((report) => report.status === "in_progress").length,
          color: statusColors.in_progress,
          icon: "wrench",
          caption: "Repairs underway",
        },
        {
          label: "Awaiting review",
          value: jobs.filter((report) => inTab(report, "review")).length,
          color: statusColors.repair_submitted,
          icon: "clock",
          caption: "Sent for checking",
        },
        {
          label: "Completed",
          value: jobs.filter((report) => inTab(report, "done")).length,
          color: statusColors.resolved,
          icon: "check-circle",
          caption: "Fixed and verified",
        },
      ]}
      listTitle="Up next"
      reports={active.slice(0, 3)}
      emptyText="No active jobs right now. New assignments appear here as soon as they're made."
      onOpen={(report) => router.push({ pathname: "/jobs/[id]", params: { id: report.id } })}
    />
  );
}
