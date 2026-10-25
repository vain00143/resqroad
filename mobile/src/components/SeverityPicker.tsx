import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import type { Severity } from "@/lib/reports";
import { fonts, mix, radius, severityColors, useTheme } from "@/theme";

// The same three choices and wording as the website's report form.
const choices: { severity: Severity; text: string }[] = [
  { severity: "Low", text: "Small crack or shallow pothole. Easy to avoid." },
  { severity: "Medium", text: "Noticeable damage. Drivers slow down or swerve." },
  { severity: "High", text: "Deep pothole or broken lane. A danger to vehicles." },
];

export function SeverityPicker({
  value,
  onChange,
  error,
}: {
  value: Severity | null;
  onChange: (value: Severity) => void;
  error?: string | null;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.field} accessibilityRole="radiogroup" accessibilityLabel="Severity">
      <AppText variant="label" tone="heading">
        Severity
      </AppText>
      {choices.map(({ severity, text }) => {
        const selected = value === severity;
        const tone = severityColors[severity];
        return (
          <Pressable
            key={severity}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={severity + ". " + text}
            onPress={() => onChange(severity)}
            style={[
              styles.choice,
              {
                backgroundColor: selected ? mix(tone, colors.surface, 0.1) : colors.surface,
                borderColor: selected ? tone : error ? colors.danger : colors.borderStrong,
              },
            ]}
          >
            <View style={[styles.bar, { backgroundColor: tone }]} />
            {/* The level and its description share the lines, to keep each choice short. */}
            <AppText variant="caption" tone="text2" style={styles.text}>
              <AppText variant="caption" tone="heading" style={styles.name}>
                {severity}
              </AppText>
              {"  " + text}
            </AppText>
            <View style={[styles.radio, { borderColor: selected ? tone : colors.borderStrong }]}>
              {selected ? <Icon name="check" size={11} color={tone} /> : null}
            </View>
          </Pressable>
        );
      })}
      {error ? (
        <View style={styles.error} accessibilityRole="alert">
          <Icon name="alert-circle" size={13} color={colors.danger} />
          <AppText variant="caption" tone="danger" style={styles.text}>
            {error}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 12,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  bar: { width: 3, alignSelf: "stretch", borderRadius: 2 },
  text: { flex: 1, fontSize: 12.5, lineHeight: 17 },
  name: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 17 },
  error: { flexDirection: "row", alignItems: "center", gap: 5 },
  radio: { width: 18, height: 18, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderRadius: 9 },
});
