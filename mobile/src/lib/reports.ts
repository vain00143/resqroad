// Report vocabulary shared with the server (see docs/API.md at the repo root).

export const reportStatuses = [
  "submitted",
  "under_review",
  "verified",
  "assigned",
  "in_progress",
  "repair_submitted",
  "resolved",
  "rejected",
  "duplicate",
] as const;

export type ReportStatus = (typeof reportStatuses)[number];

export const statusLabels: Record<ReportStatus, string> = {
  submitted: "Submitted",
  under_review: "Under Review",
  verified: "Verified",
  assigned: "Assigned",
  in_progress: "In Progress",
  repair_submitted: "Repair Submitted",
  resolved: "Resolved",
  rejected: "Rejected",
  duplicate: "Duplicate",
};

export const severities = ["High", "Medium", "Low"] as const;

export type Severity = (typeof severities)[number];
