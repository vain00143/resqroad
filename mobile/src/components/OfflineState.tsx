import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { isHostedServer } from "@/lib/api";
import { useSession } from "@/lib/session";
import { radius, useTheme } from "@/theme";

// Shown instead of a blank screen when the server can't be reached. `compact`
// is the banner shown above data that has already loaded.
export function OfflineState({ compact = false }: { compact?: boolean }) {
  const { colors } = useTheme();
  const { serverUrl, reconnect } = useSession();
  const [retrying, setRetrying] = useState(false);

  async function retry() {
    setRetrying(true);
    await reconnect().catch(() => {});
    setRetrying(false);
  }

  if (compact) {
    return (
      <View style={[styles.banner, { backgroundColor: colors.surface3, borderColor: colors.border }]}>
        <Icon name="alert-triangle" size={18} color={colors.warning} />
        <AppText variant="caption" tone="text2" style={styles.bannerText}>
          Can't reach the server. Showing the last update.
        </AppText>
        <Button label="Retry" variant="ghost" loading={retrying} onPress={retry} />
      </View>
    );
  }

  return (
    <View style={[styles.full, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
        <Icon name="alert-circle" size={26} color={colors.primarySoftText} />
      </View>
      <AppText variant="heading" style={styles.center}>
        Can't reach the ResQRoad server
      </AppText>
      <AppText tone="text2" style={styles.center}>
        {isHostedServer(serverUrl)
          ? "Check this phone's internet connection. If ResQRoad hasn't been used for a while, the server can take up to a minute to wake up."
          : "Check that the server is running and that your phone is on the same Wi-Fi as " + (serverUrl || "the server") + "."}
      </AppText>
      <Button label="Try again" loading={retrying} onPress={retry} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 12,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  bannerText: { flex: 1 },
  full: { alignItems: "center", gap: 10, padding: 24, borderWidth: 1, borderRadius: radius.lg },
  icon: { width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: radius.lg },
  center: { textAlign: "center" },
  button: { alignSelf: "stretch", marginTop: 6 },
});
