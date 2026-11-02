import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";
import { mix, radius, useTheme } from "@/theme";

type Tone = "info" | "error" | "success" | "warning";

const icons: Record<Tone, IconName> = {
  info: "info",
  error: "alert-circle",
  success: "check-circle",
  warning: "alert-triangle",
};

// An inline message, like the website's `.alert`. `progress` (0 to 1) adds a
// bar under the message, for uploads.
export function Notice({
  tone = "info",
  title,
  message,
  progress,
}: {
  tone?: Tone;
  title?: string;
  message: string;
  progress?: number | null;
}) {
  const { colors } = useTheme();
  const toneColor = { info: colors.accent, error: colors.danger, success: colors.success, warning: colors.warning }[tone];
  const textColor = mix(toneColor, colors.text, 0.45);
  const showBar = typeof progress === "number";
  return (
    <View
      accessibilityRole={tone === "error" ? "alert" : showBar ? "progressbar" : undefined}
      accessibilityValue={showBar ? { min: 0, max: 100, now: Math.round(progress * 100) } : undefined}
      style={[styles.box, { backgroundColor: mix(toneColor, colors.surface, 0.1), borderColor: mix(toneColor, colors.surface, 0.3) }]}
    >
      <Icon name={icons[tone]} size={16} color={toneColor} />
      <View style={styles.text}>
        {title ? (
          <AppText variant="bodyStrong" color={textColor}>
            {title}
          </AppText>
        ) : null}
        <AppText variant="label" color={textColor}>
          {message}
        </AppText>
        {showBar ? (
          <View style={[styles.track, { backgroundColor: mix(toneColor, colors.surface, 0.22) }]}>
            <View style={[styles.bar, { width: `${Math.min(100, Math.max(0, progress * 100))}%`, backgroundColor: toneColor }]} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  text: { flex: 1, gap: 2 },
  track: { height: 4, marginTop: 6, overflow: "hidden", borderRadius: 2 },
  bar: { height: "100%", borderRadius: 2 },
});
