import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { radius, useTheme } from "@/theme";

// A row of filter chips with counts (shown once data has loaded).
export function Chips<Key extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: Key; label: string; count?: number }[];
  value: Key;
  onChange: (key: Key) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.key)}
            style={[
              styles.chip,
              {
                backgroundColor: selected ? colors.heading : colors.surface,
                borderColor: selected ? colors.heading : colors.borderStrong,
              },
            ]}
          >
            <AppText variant="label" color={selected ? colors.bg : colors.text}>
              {option.label}
              {option.count === undefined ? "" : " " + option.count}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 12, minHeight: 32, justifyContent: "center", borderWidth: 1, borderRadius: radius.full },
});
