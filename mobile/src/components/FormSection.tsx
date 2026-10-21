import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { fonts, radius, useTheme } from "@/theme";

// A numbered card of the report form, like the website's `.form-section`.
export function FormSection({
  step,
  title,
  text,
  children,
}: {
  step: number;
  title: string;
  text: string;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.head}>
        <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
          <AppText style={styles.badgeText} color={colors.primarySoftText}>
            {step}
          </AppText>
        </View>
        <View style={styles.headText}>
          <AppText variant="heading">{title}</AppText>
          <AppText variant="caption" tone="text2">
            {text}
          </AppText>
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 16, padding: 16, borderWidth: 1, borderRadius: radius.lg },
  head: { flexDirection: "row", gap: 12 },
  badge: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: radius.sm },
  badgeText: { fontFamily: fonts.bold, fontSize: 14 },
  headText: { flex: 1, gap: 2 },
});
