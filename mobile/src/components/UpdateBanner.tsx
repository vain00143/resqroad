import { useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { onUpdate, type Update } from "@/lib/updates";
import { radius, useTheme } from "@/theme";

const visibleMs = 6000;

// The in-app version of a status notification: slides in at the top, opens
// the report or job when tapped, and hides itself after a few seconds.
export function UpdateBanner() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [update, setUpdate] = useState<Update | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setUpdate(null));
  }, [opacity]);

  useEffect(
    () =>
      onUpdate((next) => {
        clearTimeout(timer.current);
        setUpdate(next);
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
        timer.current = setTimeout(hide, visibleMs);
      }),
    [opacity, hide],
  );

  if (!update) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { top: insets.top + 8, opacity, transform: [{ translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] }]}
    >
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={update.title + ". " + update.body.replace(/[^.!?]$/, "$&.") + " Opens " + update.id + "."}
          onPress={() => {
            hide();
            router.push(update.path as Href);
          }}
          style={styles.open}
        >
          <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
            <Icon name="bell" size={18} color={colors.primarySoftText} />
          </View>
          <View style={styles.text}>
            <AppText variant="bodyStrong" tone="heading" numberOfLines={1}>
              {update.title}
            </AppText>
            <AppText variant="caption" tone="text2" numberOfLines={2}>
              {update.body}
            </AppText>
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={10} onPress={hide}>
          <Icon name="x" size={18} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 12, right: 12 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderRadius: radius.lg,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  open: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: radius.md },
  text: { flex: 1 },
});
