import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import type { Severity } from "@/lib/reports";
import { mix, radius, severityColors, useTheme } from "@/theme";

// The same three choices and wording as the website's report form.
const choices: { severity: Severity; text: string }[] = [
  { severity: "Low", text: "Small crack or shallow pothole. Easy to avoid." },
  { severity: "Medium", text: "Noticeable damage. Drivers slow down or swerve." },
  { severity: "High", text: "Deep pothole or broken lane. A danger to vehicles." },
];

export function SeverityPicker({ value, onChange }: { value: Severity | null; onChange: (value: Severity) => void }) {
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
            onPress={() => onChange(severity)}
            style={[
              styles.choice,
              {
                backgroundColor: selected ? mix(tone, colors.surface, 0.1) : colors.surface,
                borderColor: selected ? tone : colors.borderStrong,
              },
            ]}
          >
            <View style={[styles.bar, { backgroundColor: tone }]} />
            <View style={styles.text}>
              <AppText variant="bodyStrong" tone="heading">
                {severity}
              </AppText>
              <AppText variant="caption" tone="text2">
                {text}
              </AppText>
            </View>
            <View style={[styles.radio, { borderColor: selected ? tone : colors.borderStrong }]}>
              {selected ? <Icon name="check" size={14} color={tone} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: 1.5,
    borderRadius: radius.md,
  },
  bar: { width: 4, alignSelf: "stretch", borderRadius: 2 },
  text: { flex: 1, gap: 2 },
  radio: { width: 22, height: 22, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderRadius: 11 },
});
