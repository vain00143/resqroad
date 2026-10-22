// Taking or choosing photos, shrinking them before upload, and attaching
// them to a multipart form.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Image, Platform } from "react-native";

import { serverAsset } from "@/lib/api";
import type { Photo } from "@/lib/reports";

export const maxPhotos = 5;
// About 150–300 KB per photo: still sharp enough to judge road damage.
const longestSide = 1280;

export type LocalPhoto = { uri: string; name: string };

// Camera photos are several megabytes; this keeps uploads quick on mobile data.
async function shrink(asset: ImagePicker.ImagePickerAsset, index: number): Promise<LocalPhoto> {
  const context = ImageManipulator.manipulate(asset.uri);
  const { width, height } = asset;
  if (!width || !height || Math.max(width, height) > longestSide) {
    // Give only one side; the web version breaks on an explicit null.
    context.resize(width >= height ? { width: longestSide } : { height: longestSide });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  const base = (asset.fileName ?? "photo-" + (Date.now() + index)).replace(/\.[^.]+$/, "");
  return { uri: saved.uri, name: base + ".jpg" };
}

export class PermissionError extends Error {}

// Which form opened the camera ("report", or "repair:RPT-1045:before"), kept
// while the camera is open. On phones short of memory Android may close the
// app meanwhile; the photo then arrives after it restarts (takePendingPhotos).
const pendingCameraKey = "resqroad.pendingCamera";

// Returns the new photos, or an empty list when the person cancels. `target`
// names the form the photos are for.
export async function addPhotos(source: "camera" | "library", room: number, target: string): Promise<LocalPhoto[]> {
  let result: ImagePicker.ImagePickerResult;
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted && Platform.OS !== "web") {
      throw new PermissionError("Camera access is off. Allow it in your phone's Settings, or choose photos from the gallery.");
    }
    await AsyncStorage.setItem(pendingCameraKey, target).catch(() => {});
    try {
      result = await ImagePicker.launchCameraAsync({ mediaTypes: "images", quality: 0.9 });
    } finally {
      await AsyncStorage.removeItem(pendingCameraKey).catch(() => {});
    }
  } else {
    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsMultipleSelection: room > 1,
      selectionLimit: room,
      quality: 0.9,
    });
  }
  if (result.canceled || !result.assets) {
    return [];
  }
  return Promise.all(result.assets.slice(0, room).map(shrink));
}

// A photo taken while Android closed the app (see pendingCameraKey), resized,
// if it was for `target`; otherwise an empty list.
export async function takePendingPhotos(target: string, room: number): Promise<LocalPhoto[]> {
  if (Platform.OS === "web" || room <= 0) {
    return [];
  }
  try {
    if ((await AsyncStorage.getItem(pendingCameraKey)) !== target) {
      return [];
    }
    const result = await ImagePicker.getPendingResultAsync();
    await AsyncStorage.removeItem(pendingCameraKey);
    if (!result || !("canceled" in result) || result.canceled || !result.assets) {
      return [];
    }
    return await Promise.all(result.assets.slice(0, room).map(shrink));
  } catch {
    return [];
  }
}

// Resized photos live in the app's cache folder, which Android may empty;
// keeps the ones whose file is still there.
export async function keepExistingPhotos(photos: LocalPhoto[]): Promise<LocalPhoto[]> {
  const exists = (uri: string) =>
    new Promise<boolean>((resolve) => {
      Image.getSize(
        uri,
        () => resolve(true),
        () => resolve(false),
      );
    });
  const kept = await Promise.all(photos.map((photo) => exists(photo.uri)));
  return photos.filter((_, index) => kept[index]);
}

// React Native sends { uri, name, type } as a file (the file:// address from
// the image manipulator); browsers need a Blob. Send the form with `upload`
// from lib/api: Expo's fetch can't send { uri } parts.
export async function appendPhoto(form: FormData, field: string, photo: LocalPhoto) {
  if (Platform.OS === "web") {
    const blob = await (await fetch(photo.uri)).blob();
    form.append(field, blob, photo.name);
    return;
  }
  form.append(field, { uri: photo.uri, name: photo.name, type: "image/jpeg" } as unknown as Blob);
}

// Sample reports list plain file names, which have no image to show.
export function photoUri(photo: Photo): string | null {
  return typeof photo === "string" ? null : serverAsset(photo.src);
}
