// A crew's unsent repair update (notes and before/after photos), kept on the
// phone per job so it survives the app closing (or Android closing it) before
// it's sent. One draft per account and job; cleared once the update goes through.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { keepExistingPhotos, type LocalPhoto } from "@/lib/photos";

export type RepairDraft = { notes: string; before: LocalPhoto[]; after: LocalPhoto[] };

function storageKey(userId: string, reportId: string) {
  return "resqroad.repairDraft." + userId + "." + reportId;
}

export async function loadRepairDraft(userId: string, reportId: string): Promise<RepairDraft | null> {
  try {
    const saved = await AsyncStorage.getItem(storageKey(userId, reportId));
    if (!saved) {
      return null;
    }
    const draft = JSON.parse(saved) as Partial<RepairDraft>;
    return {
      notes: draft.notes ?? "",
      before: await keepExistingPhotos(draft.before ?? []),
      after: await keepExistingPhotos(draft.after ?? []),
    };
  } catch {
    return null;
  }
}

export async function saveRepairDraft(userId: string, reportId: string, draft: RepairDraft) {
  try {
    if (!draft.notes.trim() && draft.before.length === 0 && draft.after.length === 0) {
      await AsyncStorage.removeItem(storageKey(userId, reportId));
      return;
    }
    // In a browser the photos are temporary blob addresses that don't
    // survive a reload, so only the notes are kept there.
    const keepPhotos = Platform.OS !== "web";
    await AsyncStorage.setItem(
      storageKey(userId, reportId),
      JSON.stringify({ notes: draft.notes, before: keepPhotos ? draft.before : [], after: keepPhotos ? draft.after : [] }),
    );
  } catch {
    // Saving the draft is a convenience; the form itself still works.
  }
}

export async function clearRepairDraft(userId: string, reportId: string) {
  await AsyncStorage.removeItem(storageKey(userId, reportId)).catch(() => {});
}
