import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// The sign-in token and server address live in the phone's secure storage.
// expo-secure-store has no web version, so the browser preview uses
// localStorage instead.

export const storageKeys = {
  server: "resqroad.server",
  token: "resqroad.token",
  user: "resqroad.user",
} as const;

type Key = (typeof storageKeys)[keyof typeof storageKeys];

export async function readItem(key: Key): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function writeItem(key: Key, value: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Private browsing can block storage; the app still works for this visit.
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function removeItem(key: Key): Promise<void> {
  if (Platform.OS === "web") {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Nothing to remove.
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
