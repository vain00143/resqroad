// Taking or choosing photos, shrinking them before upload, and attaching
// them to a multipart form.

import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

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

// Returns the new photos, or an empty list when the person cancels.
export async function addPhotos(source: "camera" | "library", room: number): Promise<LocalPhoto[]> {
  let result: ImagePicker.ImagePickerResult;
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted && Platform.OS !== "web") {
      throw new PermissionError("Camera access is off. Allow it in your phone's Settings, or choose photos from the gallery.");
    }
    result = await ImagePicker.launchCameraAsync({ mediaTypes: "images", quality: 0.9 });
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
