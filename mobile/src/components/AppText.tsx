import { StyleSheet, Text, type TextProps, type TextStyle } from "react-native";

import { fonts, useTheme, type ThemeColors } from "@/theme";

// A compact phone type scale: the website's hierarchy, a size or two smaller.
const variants = StyleSheet.create({
  // Wide uppercase headlines, like the website's `.display`.
  display: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, letterSpacing: -0.2, textTransform: "uppercase" },
  title: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24 },
  heading: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21 },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 10.5, lineHeight: 14, letterSpacing: 0.9, textTransform: "uppercase" },
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

// Text grows with the phone's font size setting, up to this much, so the
// largest settings stay readable without breaking the layout.
export const maxFontScale = 1.4;

export type AppTextProps = TextProps & {
  variant?: Variant;
  tone?: Tone;
  color?: string;
};

export function AppText({ variant = "body", tone, color, style, ...props }: AppTextProps) {
  const { colors } = useTheme();
  const toneColor: TextStyle = { color: color ?? colors[(tone ?? defaultTone[variant]) as keyof ThemeColors] };
  return (
    <Text maxFontSizeMultiplier={maxFontScale} {...props} style={[styles.base, variants[variant], toneColor, style]} />
  );
}

const styles = StyleSheet.create({
  // Android adds extra space above Poppins by default.
  base: { includeFontPadding: false },
});
