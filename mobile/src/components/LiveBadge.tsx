import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { useSession } from "@/lib/session";
import { radius, useTheme } from "@/theme";

// Shows whether live updates from the server are coming in.
export function LiveBadge() {
  const { colors } = useTheme();
  const { connection } = useSession();
  const look = {
    online: { color: colors.success, label: "Live" },
    connecting: { color: colors.warning, label: "Connecting" },
    offline: { color: colors.danger, label: "Offline" },
  }[connection];
  return (
    <View
      accessibilityLabel={"Live updates: " + look.label}
      style={[styles.badge, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={[styles.dot, { backgroundColor: look.color }]} />
      <AppText variant="caption" tone="text2">
        {look.label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    minHeight: 24,
    borderWidth: 1,
    borderRadius: radius.full,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
