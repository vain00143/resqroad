// Dates as the website shows them, in the phone's time zone.

const dateFormat = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatDate(iso: string | null | undefined) {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : dateFormat.format(date);
}

const dayFormat = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" });
const dayYearFormat = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" });

// "Oct 23", with the year when it isn't this year (the website's short day).
export function formatShortDay(iso: string | null | undefined) {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return (date.getFullYear() === new Date().getFullYear() ? dayFormat : dayYearFormat).format(date);
}

export function timeAgo(iso: string | null | undefined) {
  if (!iso) {
    return "";
  }
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) {
    return "just now";
  }
  const steps: [number, string][] = [
    [60, "minute"],
    [3600, "hour"],
    [86400, "day"],
    [604800, "week"],
  ];
  if (seconds >= 30 * 86400) {
    return formatDate(iso);
  }
  let unit = steps[0];
  for (const step of steps) {
    if (seconds >= step[0]) {
      unit = step;
    }
  }
  const value = Math.floor(seconds / unit[0]);
  return value + " " + unit[1] + (value === 1 ? "" : "s") + " ago";
}
