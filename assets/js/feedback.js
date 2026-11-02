/* The resident's feedback on a finished repair, shared by the website (the
   feedback form and the administrator's view of it) and the server, which
   checks every answer again.

   Once a report is resolved, the resident who filed it rates the repair
   (1 to 5 stars), says whether the road is fully repaired, and can pick quick
   tags, add a comment, and add photos of the repaired spot. */

export const feedbackCommentMax = 500;
export const feedbackPhotosMax = 3;

// "Is the road fully repaired?" Stored in report_feedback.outcome. `tone` is
// the workflow status whose color the answer uses.
export const repairOutcomes = [
  {
    value: "fixed",
    label: "Yes",
    hint: "Smooth and safe again",
    summary: "Fully repaired",
    icon: "check-circle",
    tone: "resolved",
  },
  {
    value: "partial",
    label: "Partially",
    hint: "Some damage is left",
    summary: "Partially repaired",
    icon: "alert-circle",
    tone: "in_progress",
  },
  {
    value: "unresolved",
    label: "No",
    hint: "The damage is still there",
    summary: "Not repaired",
    icon: "ban",
    tone: "rejected",
  },
];

// Quick tags, praise first. Stored in report_feedback.tags as their values,
// comma separated, so new tags can be added here without a database change.
export const feedbackTags = [
  { value: "fast", label: "Fast resolution", positive: true },
  { value: "quality", label: "High-quality repair", positive: true },
  { value: "smooth", label: "Smooth pavement", positive: true },
  { value: "clean", label: "Site left clean", positive: true },
  { value: "debris", label: "Left debris", positive: false },
  { value: "incomplete", label: "Work incomplete", positive: false },
  { value: "uneven", label: "Uneven surface", positive: false },
  { value: "slow", label: "Took too long", positive: false },
];

export function repairOutcome(value) {
  return (
    repairOutcomes.find(function (outcome) {
      return outcome.value === value;
    }) || null
  );
}

export function feedbackTag(value) {
  return (
    feedbackTags.find(function (tag) {
      return tag.value === value;
    }) || null
  );
}
