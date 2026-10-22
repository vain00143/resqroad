// The report form as filled in so far, kept on the phone so it survives the
// app closing (or Android closing it) before the report is sent. One draft
// per account; cleared once the report goes through.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image, Platform } from "react-native";

import type { MapPoint } from "@/components/map/mapHtml";
import type { LocalPhoto } from "@/lib/photos";
import type { Severity } from "@/lib/reports";

export type ReportDraft = {
  title: string;
  severity: Severity | null;
  description: string;
  point: MapPoint | null;
  road: string;
  location: string;
  photos: LocalPhoto[];
};

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
    !draft.location.trim() &&
    draft.photos.length === 0
  );
}

// Resized photos live in the app's cache folder, which Android may empty.
function photoExists(uri: string) {
  return new Promise<boolean>((resolve) => {
    Image.getSize(
      uri,
      () => resolve(true),
      () => resolve(false),
    );
  });
}

export async function loadReportDraft(userId: string): Promise<ReportDraft | null> {
  try {
    const saved = await AsyncStorage.getItem(storageKey(userId));
    if (!saved) {
      return null;
    }
    const draft = JSON.parse(saved) as ReportDraft;
    const kept = await Promise.all(draft.photos.map((photo) => photoExists(photo.uri)));
    return { ...draft, photos: draft.photos.filter((_, index) => kept[index]) };
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
