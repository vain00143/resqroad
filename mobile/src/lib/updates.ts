// Status-change alerts for the signed-in person, worked out from the live
// updates the server already sends (no push server needed). While the app is
// open they show as an in-app banner; while it's in the background (and
// still running) they show as a phone notification.

import * as Notifications from "expo-notifications";
import { AppState, Platform } from "react-native";

import type { Report, User } from "@/lib/reports";

export type Update = { id: string; title: string; body: string; path: string };

// What changed on a report that matters to this person, or null.
export function describeChange(previous: Report | undefined, next: Report, user: User): Update | null {
  // Skip changes this person made themselves (their own report, start, or repair).
  const latest = next.history[next.history.length - 1];
  if (latest && latest.actor === user.name) {
    return null;
  }

  if (user.role === "citizen") {
    if (next.reporterId !== user.id || !previous || previous.status === next.status) {
      return null;
    }
    const path = "/reports/" + next.id;
    const note = latest?.note;
    const messages: Partial<Record<Report["status"], [string, string]>> = {
      under_review: [next.id + " is under review", "The Road Maintenance Office is looking at your report."],
      verified: [next.id + " was verified", "The damage is confirmed and will be assigned to a crew."],
      assigned: ["A crew is assigned to " + next.id, (next.assignedName || "A maintenance crew") + " will handle the repair."],
      in_progress: ["Repair work on " + next.id, "The crew is working on " + next.road + "."],
      repair_submitted: ["Repair finished on " + next.id, "The crew submitted the repair. An administrator is checking it."],
      resolved: [next.id + " is resolved", next.title + " has been fixed. Thank you for reporting it."],
      rejected: [next.id + " was rejected", note || "Open the report to see why."],
      duplicate: [next.id + " was marked a duplicate", note || "Another report already covers this spot."],
    };
    const message = messages[next.status];
    return message ? { id: next.id, title: message[0], body: message[1], path } : null;
  }

  if (user.role === "maintenance") {
    const path = "/jobs/" + next.id;
    const wasMine = previous?.assignedTo === user.id;
    const isMine = next.assignedTo === user.id;
    if (isMine && !wasMine) {
      return { id: next.id, title: "New job: " + next.id, body: next.title + " · " + next.road, path };
    }
    if (wasMine && !isMine) {
      return { id: next.id, title: next.id + " was reassigned", body: "It's no longer on your list of jobs.", path };
    }
    if (!isMine || !previous || previous.status === next.status) {
      return null;
    }
    if (previous.status === "repair_submitted" && next.status === "in_progress") {
      return {
        id: next.id,
        title: "More work requested on " + next.id,
        body: latest?.note || "The administrator sent the repair back. Open the job to see why.",
        path,
      };
    }
    if (next.status === "resolved") {
      return { id: next.id, title: next.id + " verified", body: "The administrator verified your repair.", path };
    }
  }
  return null;
}

/* ---------- Showing updates ---------- */

const channelId = "report-updates";
const listeners = new Set<(update: Update) => void>();

// The in-app banner listens here.
export function onUpdate(listener: (update: Update) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function announce(update: Update) {
  if (AppState.currentState === "active" || Platform.OS === "web") {
    listeners.forEach((listener) => listener(update));
    return;
  }
  Notifications.scheduleNotificationAsync({
    content: { title: update.title, body: update.body, data: { path: update.path } },
    trigger: Platform.OS === "android" ? { channelId } : null,
  }).catch(() => {});
}

// Asks for permission once signed in. Android 13+ only shows the prompt after
// a channel exists.
export async function setUpNotifications() {
  if (Platform.OS === "web") {
    return;
  }
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(channelId, {
      name: "Report updates",
      description: "When one of your reports or jobs changes status.",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (!current.granted && current.canAskAgain) {
    await Notifications.requestPermissionsAsync();
  }
}

// Opens the report or job when a notification is tapped.
export function onNotificationTap(open: (path: string) => void) {
  if (Platform.OS === "web") {
    return () => {};
  }
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const path = response.notification.request.content.data?.path;
    if (typeof path === "string") {
      open(path);
    }
  });
  return () => subscription.remove();
}
