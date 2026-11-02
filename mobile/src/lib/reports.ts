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

export const openStatuses: ReportStatus[] = [
  "submitted",
  "under_review",
  "verified",
  "assigned",
  "in_progress",
  "repair_submitted",
];

// The happy path a report moves along; rejected and duplicate end it early.
export const workflow: ReportStatus[] = [...openStatuses, "resolved"];

export function isOpen(status: ReportStatus) {
  return openStatuses.includes(status);
}

// Reports must be inside Bulacan (the server checks the same box).
export const bulacan = { south: 14.5, north: 15.2, west: 120.3, east: 121.2 };

export function inBulacan(lat: number, lng: number) {
  return lat >= bulacan.south && lat <= bulacan.north && lng >= bulacan.west && lng <= bulacan.east;
}

// A report's `location` is the barangay, then the municipality and province:
// "Borol 1st, Balagtas, Bulacan". The form asks for the two parts separately
// (as the website does) and joins them for the server.
export function joinPlace(barangay: string, municipality: string) {
  return barangay.trim() + ", " + municipality.trim();
}

export function splitPlace(location: string) {
  const comma = location.indexOf(",");
  return comma < 0
    ? { barangay: location.trim(), municipality: "" }
    : { barangay: location.slice(0, comma).trim(), municipality: location.slice(comma + 1).trim() };
}

// Accepts "RPT-1048", "rpt 1048", or "1048".
export function normalizeReportId(input: string): string | null {
  const match = /^(?:rpt)?[\s-]*(\d+)$/i.exec(input.trim());
  return match ? "RPT-" + match[1] : null;
}

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

// The resident's answer to "Is the road fully repaired?" (see lib/feedback).
export type RepairOutcomeValue = "fixed" | "partial" | "unresolved";

// The resident's feedback on a finished repair. `outcome` is null on ratings
// sent before the website asked whether the road is fully repaired; `tags`
// are tag values from lib/feedback.
export type Feedback = {
  rating: number;
  outcome: RepairOutcomeValue | null;
  tags: string[];
  comment: string;
  photos: Photo[];
  at: string;
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
  // Null until they give feedback on the repair.
  feedback?: Feedback | null;
};
