import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { brand, mix, radius, useTheme } from "@/theme";

// The invitation at the top of a resolved report's page, as on the website.
export function FeedbackInvite({ reportId }: { reportId: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.box,
        {
          borderColor: mix(colors.accent, colors.border, 0.3),
          backgroundImage:
            "linear-gradient(120deg, " +
            mix(colors.accent, colors.surface, 0.12) +
            ", " +
            mix(brand[100], colors.surface, 0.12) +
            ")",
        },
      ]}
    >
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: colors.accent }]}>
          <Icon name="star" size={20} color="#FFFFFF" fill="#FFFFFF" />
        </View>
        <View style={styles.text}>
          <AppText variant="bodyStrong" tone="heading">
            Your road was repaired. How did we do?
          </AppText>
          <AppText variant="caption" tone="text2">
            Rate the repair and tell the office whether the road is fully fixed. It takes less than a minute.
          </AppText>
        </View>
      </View>
      <Button
        label="Give feedback"
        onPress={() => router.push({ pathname: "/feedback/[id]", params: { id: reportId } })}
        icon={<Icon name="star" size={16} color="#FFFFFF" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 12, padding: 14, borderWidth: 1, borderRadius: radius.lg },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.md },
  text: { flex: 1, gap: 2 },
});
