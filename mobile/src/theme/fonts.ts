// Poppins for body copy and UI, and Archivo Expanded for display headlines
// (the website's stand-in for Nofex, which isn't available as a free font).
// Each weight is its own family on Android, so pick a family, not fontWeight.

import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";

export const fontFiles = {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  ArchivoExpanded_800ExtraBold: require("../../assets/fonts/ArchivoExpanded-ExtraBold.ttf"),
};

export const fonts = {
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
  semibold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
  display: "ArchivoExpanded_800ExtraBold",
} as const;
