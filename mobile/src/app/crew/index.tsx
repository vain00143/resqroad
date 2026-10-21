import { HomeScaffold } from "@/components/HomeScaffold";
import { useSession } from "@/lib/session";
import { useTheme } from "@/theme";

export default function CrewHome() {
  const { statusColors } = useTheme();
  const { user, reports } = useSession();
  const jobs = reports.filter((report) => report.assignedTo === user?.id);
  const active = jobs.filter((report) => report.status === "assigned" || report.status === "in_progress");

  return (
    <HomeScaffold
      subtitle={(user?.team || "Maintenance crew") + " · Maintenance"}
      stats={[
        { label: "Active jobs", value: active.length, color: statusColors.in_progress },
        {
          label: "Awaiting review",
          value: jobs.filter((report) => report.status === "repair_submitted").length,
          color: statusColors.repair_submitted,
        },
        { label: "Completed", value: jobs.filter((report) => report.status === "resolved").length, color: statusColors.resolved },
      ]}
      listTitle="Up next"
      reports={active.slice(0, 3)}
      emptyText="No active jobs right now."
      comingNext="Job details, starting repairs, before-and-after photos, and the job map come in step 4."
    />
  );
}
