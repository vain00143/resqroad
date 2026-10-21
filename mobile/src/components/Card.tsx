import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

import { AppText } from "@/components/AppText";
import { radius, useTheme } from "@/theme";

export function Card({ title, children, style }: { title?: string; children: ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
      {title ? <AppText variant="eyebrow">{title}</AppText> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, padding: 16, borderWidth: 1, borderRadius: radius.lg },
});
