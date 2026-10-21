import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";
import { mix, radius, useTheme } from "@/theme";

type Tone = "info" | "error" | "success";

const icons: Record<Tone, IconName> = { info: "info", error: "alert-circle", success: "check-circle" };

// An inline message, like the website's `.alert`.
export function Notice({ tone = "info", message }: { tone?: Tone; message: string }) {
  const { colors } = useTheme();
  const toneColor = { info: colors.accent, error: colors.danger, success: colors.success }[tone];
  return (
    <View
      accessibilityRole={tone === "error" ? "alert" : undefined}
      style={[styles.box, { backgroundColor: mix(toneColor, colors.surface, 0.1), borderColor: mix(toneColor, colors.surface, 0.3) }]}
    >
      <Icon name={icons[tone]} size={18} color={toneColor} />
      <AppText variant="label" style={styles.text} color={mix(toneColor, colors.text, 0.45)}>
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  text: { flex: 1 },
});
