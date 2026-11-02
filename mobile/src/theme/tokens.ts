// ResQRoad design tokens, copied from the website's assets/css/core.css so the
// app and the site share one brand: the Road Orange scale, the supporting
// colors, and one tone per severity and workflow status.

import type { ReportStatus, Severity } from "@/lib/reports";

export const brand = {
  900: "#7B3621",
  800: "#974328",
  700: "#B34F2F",
  600: "#CF5C36",
  500: "#D46E44",
  400: "#DA8052",
  300: "#DF9260",
  200: "#E4A46F",
  150: "#EAB67D",
  100: "#EFC88B",
  black: "#000000",
  blush: "#EEE5E9",
  asphalt: "#7C7C7C",
  cream: "#FDF6EC",
  ink: "#141110",
} as const;

export type ColorScheme = "light" | "dark";

const light = {
  bg: "#F6F3F0",
  surface: "#FFFFFF",
  surface2: "#FBF9F7",
  surface3: "#F3EEEA",
  surfaceSunken: "#EFE9E4",
  border: "#EBE4DE",
  borderStrong: "#DCD3CB",
  heading: "#110E0C",
  text: "#2B2522",
  text2: "#5D5550",
  text3: "#766D67",
  icon: "#9B918A",
  placeholder: "#A39992",

  // Buttons use Road Orange 700 so white text meets WCAG AA.
  primary: brand[700],
  primaryPressed: brand[800],
  onPrimary: "#FFFFFF",
  accent: brand[600],
  link: brand[700],
  primarySoft: "#FBEEE7",
  primarySoftStrong: "#F6DCCF",
  primarySoftText: brand[800],

  pressed: "rgba(43, 37, 34, 0.09)",
  overlay: "rgba(14, 11, 10, 0.46)",
  focus: brand[600],

  success: "#2F9461",
  warning: "#D9961E",
  danger: "#C0392B",
  info: "#2F6FD6",
};

export type ThemeColors = Record<keyof typeof light, string>;

const dark: ThemeColors = {
  bg: "#0E0C0B",
  surface: "#171413",
  surface2: "#1B1817",
  surface3: "#231F1D",
  surfaceSunken: "#121010",
  border: "#2B2624",
  borderStrong: "#3A3431",
  heading: "#FFFFFF",
  text: "#EBE5E1",
  text2: "#BBB2AC",
  text3: "#958C86",
  icon: "#D6CFCA",
  placeholder: "#776F6A",

  primary: brand[700],
  primaryPressed: brand[600],
  onPrimary: "#FFFFFF",
  accent: "#E0774F",
  link: "#EC9572",
  primarySoft: "rgba(207, 92, 54, 0.14)",
  primarySoftStrong: "rgba(207, 92, 54, 0.24)",
  primarySoftText: "#F2A585",

  pressed: "rgba(255, 255, 255, 0.09)",
  overlay: "rgba(0, 0, 0, 0.62)",
  focus: "#E0774F",

  success: "#2F9461",
  warning: "#D9961E",
  danger: "#E2584A",
  info: "#2F6FD6",
};

export const colors: Record<ColorScheme, ThemeColors> = { light, dark };

// Severity keeps its own hues: red for high, orange for medium, yellow for low.
export const severityColors: Record<Severity, string> = {
  High: "#D9362B",
  Medium: "#E8771A",
  Low: "#E3B100",
};

// The website's solid severity labels (`.sev`): white text on a darker shade
// of each hue.
export const severityLabelColors: Record<Severity, string> = {
  High: "#C62F25",
  Medium: "#B8540C",
  Low: "#957000",
};

const lightStatus: Record<ReportStatus, string> = {
  submitted: "#8A817B",
  under_review: "#D9961E",
  verified: "#CF5C36",
  assigned: "#974328",
  in_progress: "#2F6FD6",
  repair_submitted: "#7C5CD6",
  resolved: "#2F9461",
  rejected: "#C0392B",
  duplicate: "#A39B95",
};

export const statusColors: Record<ColorScheme, Record<ReportStatus, string>> = {
  light: lightStatus,
  dark: { ...lightStatus, submitted: "#A39A94", duplicate: "#8A827D" },
};

export const radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  full: 999,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

// Mixes two #RRGGBB colors like CSS `color-mix(in srgb, a weight%, b)`.
export function mix(a: string, b: string, weight: number): string {
  const channel = (hex: string, index: number) => parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
  const parts = [0, 1, 2].map((index) =>
    Math.round(channel(a, index) * weight + channel(b, index) * (1 - weight))
      .toString(16)
      .padStart(2, "0"),
  );
  return "#" + parts.join("");
}

// Adds an alpha channel to a #RRGGBB color.
export function withAlpha(hex: string, alpha: number): string {
  return hex + Math.round(alpha * 255).toString(16).padStart(2, "0");
}

function luminance(hex: string) {
  const [r, g, b] = [0, 1, 2].map((index) => {
    const value = parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// The color darkened just enough for white label text to meet WCAG AA
// (4.5:1), the way the website darkens its severity labels.
export function labelColor(hex: string): string {
  let color = hex;
  for (let weight = 1; weight > 0.4 && 1.05 / (luminance(color) + 0.05) < 4.5; weight -= 0.04) {
    color = mix(hex, "#000000", weight);
  }
  return color;
}
