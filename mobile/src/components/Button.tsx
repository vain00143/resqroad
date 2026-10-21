import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps, type ViewStyle } from "react-native";

import { AppText } from "@/components/AppText";
import { radius, useTheme } from "@/theme";

type Variant = "primary" | "secondary" | "ghost" | "onDark";

export type ButtonProps = Omit<PressableProps, "children" | "style"> & {
  label: string;
  variant?: Variant;
  size?: "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
  style?: ViewStyle;
};

export function Button({
  label,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  icon,
  style,
  ...props
}: ButtonProps) {
  const { colors } = useTheme();
  const inactive = Boolean(disabled || loading);

  const look: Record<Variant, { bg: string; pressedBg: string; fg: string; border: string }> = {
    primary: { bg: colors.primary, pressedBg: colors.primaryPressed, fg: colors.onPrimary, border: colors.primary },
    secondary: { bg: colors.surface, pressedBg: colors.surface3, fg: colors.text, border: colors.borderStrong },
    ghost: { bg: "transparent", pressedBg: colors.pressed, fg: colors.text, border: "transparent" },
    // For buttons on the always-dark brand panels.
    onDark: {
      bg: "rgba(255, 255, 255, 0.08)",
      pressedBg: "rgba(255, 255, 255, 0.16)",
      fg: "#FFFFFF",
      border: "rgba(255, 255, 255, 0.22)",
    },
  };
  const { bg, pressedBg, fg, border } = look[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        size === "lg" ? styles.lg : styles.md,
        { backgroundColor: pressed ? pressedBg : bg, borderColor: border, opacity: inactive && !loading ? 0.55 : 1 },
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.content}>
          <AppText variant="bodyStrong" color={fg}>
            {label}
          </AppText>
          {icon}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 18,
  },
  md: { minHeight: 44 },
  lg: { minHeight: 52 },
  content: { flexDirection: "row", alignItems: "center", gap: 8 },
});
