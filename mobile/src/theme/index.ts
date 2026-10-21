import { useColorScheme } from "react-native";

import { colors, statusColors, type ColorScheme } from "./tokens";

export * from "./tokens";
export { fonts } from "./fonts";

// The app follows the phone's light or dark setting.
export function useTheme() {
  const scheme: ColorScheme = useColorScheme() === "dark" ? "dark" : "light";
  return { scheme, colors: colors[scheme], statusColors: statusColors[scheme] };
}
