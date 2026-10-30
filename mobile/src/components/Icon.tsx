import { SvgXml } from "react-native-svg";

import { iconPaths, type IconName } from "@/components/iconPaths";
import { useTheme } from "@/theme";

export type { IconName };

// The website's 24px stroke icons (assets/js/icons.js), drawn the same way.
// `fill` fills the shape too, like the website's lit rating stars.
export function Icon({ name, size = 20, color, fill }: { name: IconName; size?: number; color?: string; fill?: string }) {
  const { colors } = useTheme();
  const xml =
    '<svg viewBox="0 0 24 24" fill="' +
    (fill ?? "none") +
    '" stroke="' +
    (color ?? colors.icon) +
    '" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
    iconPaths[name] +
    "</svg>";
  return <SvgXml xml={xml} width={size} height={size} />;
}
