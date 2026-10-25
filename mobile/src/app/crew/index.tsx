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
        { label: "Active jobs", value: active.length, color: statusColors.in_progress },
        { label: "Awaiting review", value: jobs.filter((report) => inTab(report, "review")).length, color: statusColors.repair_submitted },
        { label: "Completed", value: jobs.filter((report) => inTab(report, "done")).length, color: statusColors.resolved },
      ]}
      listTitle="Up next"
      reports={active.slice(0, 3)}
      emptyText="No active jobs right now. New assignments appear here as soon as they're made."
      onOpen={(report) => router.push({ pathname: "/jobs/[id]", params: { id: report.id } })}
    />
  );
}
