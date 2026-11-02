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

// A titled part of a long page, divided from the one above by a thin line
// instead of sitting in its own box.
export function Section({
  title,
  aside,
  children,
  first = false,
}: {
  title?: string;
  aside?: ReactNode;
  children: ReactNode;
  first?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.section, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
      {title ? (
        <View style={styles.sectionHead}>
          <AppText variant="eyebrow">{title}</AppText>
          {aside}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, padding: 14, borderWidth: 1, borderRadius: radius.lg },
  section: { gap: 10, paddingVertical: 16 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 18 },
});
