// The resident's feedback on a finished repair, as the website asks for it.
// The answers and tags are copied from the website's assets/js/feedback.js,
// which the server checks every answer against, so keep the two in step.
//
// Once a report is resolved, the resident who filed it rates the repair
// (1 to 5 stars), says whether the road is fully repaired, and can pick quick
// tags, add a comment, and add photos of the repaired spot. It's sent once.

import type { IconName } from "@/components/iconPaths";
import type { Photo, RepairOutcomeValue, Report, ReportStatus } from "@/lib/reports";

export const feedbackCommentMax = 500;
export const feedbackPhotosMax = 3;

export const ratingLabels: Record<number, string> = { 1: "Poor", 2: "Fair", 3: "Good", 4: "Very good", 5: "Excellent" };

// "Is the road fully repaired?" `tone` is the workflow status whose color the
// answer uses.
export type RepairOutcome = {
  value: RepairOutcomeValue;
  label: string;
  hint: string;
  summary: string;
  icon: IconName;
  tone: ReportStatus;
};

export const repairOutcomes: RepairOutcome[] = [
  { value: "fixed", label: "Yes", hint: "Smooth and safe again", summary: "Fully repaired", icon: "check-circle", tone: "resolved" },
  {
    value: "partial",
    label: "Partially",
    hint: "Some damage is left",
    summary: "Partially repaired",
    icon: "alert-circle",
    tone: "in_progress",
  },
  { value: "unresolved", label: "No", hint: "The damage is still there", summary: "Not repaired", icon: "ban", tone: "rejected" },
];

// Quick tags, praise first.
export type FeedbackTag = { value: string; label: string; positive: boolean };

export const feedbackTags: FeedbackTag[] = [
  { value: "fast", label: "Fast resolution", positive: true },
  { value: "quality", label: "High-quality repair", positive: true },
  { value: "smooth", label: "Smooth pavement", positive: true },
  { value: "clean", label: "Site left clean", positive: true },
  { value: "debris", label: "Left debris", positive: false },
  { value: "incomplete", label: "Work incomplete", positive: false },
  { value: "uneven", label: "Uneven surface", positive: false },
  { value: "slow", label: "Took too long", positive: false },
];

export function repairOutcome(value: string | null | undefined) {
  return repairOutcomes.find((outcome) => outcome.value === value) ?? null;
}

export function feedbackTag(value: string) {
  return feedbackTags.find((tag) => tag.value === value) ?? null;
}

// Only the resident who filed a report sees its `feedback` (null until sent).
export function canGiveFeedback(report: Report) {
  return report.status === "resolved" && report.feedback === null;
}

// When the office verified the repair and closed the report.
export function resolvedAt(report: Report) {
  const resolved = report.history.filter((entry) => entry.status === "resolved");
  return resolved.length ? resolved[resolved.length - 1].at : report.updatedAt;
}

// The resident's own first photo (or the crew's) beside the crew's first
// after-repair photo. Reports filed without photos have no "before".
export function beforeAndAfter(report: Report) {
  const before = report.evidencePhotos[0] ?? report.repair?.beforePhotos[0];
  const after = report.repair?.afterPhotos[0];
  const pair: { photo: Photo; label: string }[] = [];
  if (before) {
    pair.push({ photo: before, label: "Before" });
  }
  if (after) {
    pair.push({ photo: after, label: "After" });
  }
  return pair;
}

// The comment prompt follows the answer about the repair.
export function commentPrompt(outcome: RepairOutcomeValue | null) {
  return outcome === "partial" || outcome === "unresolved"
    ? "What still needs fixing? Describe where the damage is left."
    : "Anything else the Road Maintenance Office should know?";
}
