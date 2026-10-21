import { StyleSheet, Text, type TextProps, type TextStyle } from "react-native";

import { fonts, useTheme, type ThemeColors } from "@/theme";

const variants = StyleSheet.create({
  // Wide uppercase headlines, like the website's `.display`.
  display: { fontFamily: fonts.display, fontSize: 28, lineHeight: 31, letterSpacing: -0.3, textTransform: "uppercase" },
  title: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 29 },
  heading: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18 },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 1, textTransform: "uppercase" },
});

type Variant = keyof typeof variants;
type Tone = "heading" | "text" | "text2" | "text3" | "accent" | "link" | "danger" | "onPrimary";

const defaultTone: Record<Variant, Tone> = {
  display: "heading",
  title: "heading",
  heading: "heading",
  body: "text",
  bodyStrong: "text",
  label: "text",
  caption: "text3",
  eyebrow: "accent",
};

export type AppTextProps = TextProps & {
  variant?: Variant;
  tone?: Tone;
  color?: string;
};

export function AppText({ variant = "body", tone, color, style, ...props }: AppTextProps) {
  const { colors } = useTheme();
  const toneColor: TextStyle = { color: color ?? colors[(tone ?? defaultTone[variant]) as keyof ThemeColors] };
  return <Text {...props} style={[styles.base, variants[variant], toneColor, style]} />;
}

const styles = StyleSheet.create({
  // Android adds extra space above Poppins by default.
  base: { includeFontPadding: false },
});
