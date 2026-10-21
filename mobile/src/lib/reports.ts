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

export type Role = "admin" | "maintenance" | "citizen";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  team: string;
  active: boolean;
  createdAt: string | null;
};

export type Crew = { id: string; name: string; team: string };

// Sample reports may list a plain file name instead of an uploaded photo.
export type Photo = { id: string; name: string; src: string } | string;

export type HistoryEntry = {
  status: ReportStatus | "note";
  description: string;
  actor: string;
  at: string;
  // A rejection reason, or what the crew still needs to fix.
  note?: string;
};

export type Repair = {
  notes: string;
  beforePhotos: Photo[];
  afterPhotos: Photo[];
  submittedAt: string;
};

export type Report = {
  id: string;
  title: string;
  road: string;
  location: string;
  coordinates: { lat: number; lng: number };
  severity: Severity;
  description: string;
  reportedAt: string;
  evidencePhotos: Photo[];
  status: ReportStatus;
  assignedTo: string | null;
  assignedName?: string | null;
  repair: Repair | null;
  history: HistoryEntry[];
  updatedAt?: string;
  // Only for the resident who filed the report.
  reporterId?: string | null;
  reporter?: string;
};
