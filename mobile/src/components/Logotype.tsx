import { Image, type ImageStyle, type StyleProp } from "react-native";

import { useTheme } from "@/theme";

const logotype = require("../../assets/images/logotype.png");
const logotypeWhite = require("../../assets/images/logotype-white.png");

// The RESQROAD wordmark: black letters on light surfaces, white on dark ones.
export function Logotype({
  height = 26,
  onDark,
  style,
}: {
  height?: number;
  onDark?: boolean;
  style?: StyleProp<ImageStyle>;
}) {
  const { scheme } = useTheme();
  const white = onDark ?? scheme === "dark";
  return (
    <Image
      source={white ? logotypeWhite : logotype}
      accessibilityLabel="ResQRoad"
      resizeMode="contain"
      style={[{ height, width: (height * 748) / 127 }, style]}
    />
  );
}
