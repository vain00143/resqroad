// A crew member's jobs: the reports assigned to them, grouped and ordered the
// same way as the website's maintenance workspace.

import type { Report, ReportStatus } from "@/lib/reports";

export const jobTabs = {
  active: { label: "Active", statuses: ["assigned", "in_progress"] as ReportStatus[] },
  review: { label: "Awaiting review", statuses: ["repair_submitted"] as ReportStatus[] },
  done: { label: "Completed", statuses: ["resolved"] as ReportStatus[] },
  all: { label: "All", statuses: null },
};

export type JobTab = keyof typeof jobTabs;

export function inTab(report: Report, tab: JobTab) {
  const statuses = jobTabs[tab].statuses;
  return statuses === null || statuses.includes(report.status);
}

const statusOrder: Partial<Record<ReportStatus, number>> = { in_progress: 0, assigned: 1, repair_submitted: 2, resolved: 3 };
const severityRank = { High: 3, Medium: 2, Low: 1 };

// Repairs underway first, then waiting to start, then by severity and age.
export function jobPriority(first: Report, second: Report) {
  return (
    (statusOrder[first.status] ?? 4) - (statusOrder[second.status] ?? 4) ||
    severityRank[second.severity] - severityRank[first.severity] ||
    Date.parse(first.reportedAt) - Date.parse(second.reportedAt)
  );
}

export function myJobs(reports: Report[], userId: string | undefined) {
  return reports.filter((report) => userId && report.assignedTo === userId).sort(jobPriority);
}

// The latest time a step happened, from the report's history.
export function lastEvent(report: Report, status: ReportStatus) {
  return [...report.history].reverse().find((entry) => entry.status === status) ?? null;
}

// Set when an administrator sent a submitted repair back for more work.
export function moreWorkNote(report: Report) {
  if (report.status !== "in_progress" || !report.repair) {
    return null;
  }
  const sentBack = lastEvent(report, "in_progress");
  return sentBack?.note || "The previous repair was not accepted. Review the site and submit an updated repair.";
}

// Opens Google Maps with directions to the site (same link as the website).
export function directionsUrl(coordinates: { lat: number; lng: number }) {
  return "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(coordinates.lat + "," + coordinates.lng);
}
