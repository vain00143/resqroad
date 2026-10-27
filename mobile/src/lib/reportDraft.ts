// The report form as filled in so far, kept on the phone so it survives the
// app closing (or Android closing it) before the report is sent. One draft
// per account; cleared once the report goes through.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import type { MapPoint } from "@/components/map/mapHtml";
import { keepExistingPhotos, photoLimits, type LocalPhoto } from "@/lib/photos";
import { splitPlace, type Severity } from "@/lib/reports";

export type ReportDraft = {
  title: string;
  severity: Severity | null;
  description: string;
  point: MapPoint | null;
  road: string;
  barangay: string;
  municipality: string;
  photos: LocalPhoto[];
  // The form's page (0–3) when it was saved, so it reopens there.
  step?: number;
};

// Drafts saved by version 1.2 and earlier kept the barangay and municipality
// as one line.
type SavedDraft = Partial<ReportDraft> & { location?: string };

function storageKey(userId: string) {
  return "resqroad.reportDraft." + userId;
}

export function isEmptyDraft(draft: ReportDraft) {
  return (
    !draft.title.trim() &&
    !draft.severity &&
    !draft.description.trim() &&
    !draft.point &&
    !draft.road.trim() &&
    !draft.barangay.trim() &&
    !draft.municipality.trim() &&
    draft.photos.length === 0
  );
}

export async function loadReportDraft(userId: string): Promise<ReportDraft | null> {
  try {
    const saved = await AsyncStorage.getItem(storageKey(userId));
    if (!saved) {
      return null;
    }
    const { location, ...draft } = JSON.parse(saved) as SavedDraft;
    const place = draft.barangay === undefined && location ? splitPlace(location) : null;
    return {
      title: draft.title ?? "",
      severity: draft.severity ?? null,
      description: draft.description ?? "",
      point: draft.point ?? null,
      road: draft.road ?? "",
      barangay: place?.barangay ?? draft.barangay ?? "",
      municipality: place?.municipality ?? draft.municipality ?? "",
      step: draft.step,
      photos: (await keepExistingPhotos(draft.photos ?? [])).slice(0, photoLimits.report),
    };
  } catch {
    return null;
  }
}

export async function saveReportDraft(userId: string, draft: ReportDraft) {
  try {
    if (isEmptyDraft(draft)) {
      await AsyncStorage.removeItem(storageKey(userId));
      return;
    }
    // In a browser the photos are temporary blob addresses that don't
    // survive a reload, so only the text is kept there.
    const photos = Platform.OS === "web" ? [] : draft.photos;
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify({ ...draft, photos }));
  } catch {
    // Saving the draft is a convenience; the form itself still works.
  }
}

export async function clearReportDraft(userId: string) {
  await AsyncStorage.removeItem(storageKey(userId)).catch(() => {});
}
