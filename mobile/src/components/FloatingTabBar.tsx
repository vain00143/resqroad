import {
  BottomTabBarHeightCallbackContext,
  BottomTabBarHeightContext,
  type BottomTabBarProps,
} from "expo-router/js-tabs";
import { useContext, useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { useKeyboardHeight } from "@/components/KeyboardAware";
import { fonts, useTheme } from "@/theme";

// How much of the bottom of a tab screen the floating bar covers, so the
// screen can leave room for it (0 outside the tabs and while the keyboard is
// open, when the bar hides).
export function useTabBarSpace() {
  const height = useContext(BottomTabBarHeightContext);
  const keyboard = useKeyboardHeight();
  return height && !keyboard ? height : 0;
}

// The bottom tabs as a floating rounded bar over the screen, with nothing
// behind it: the active tab in a filled highlight that slides from tab to
// tab, the others as muted icons. `separate` names a tab drawn as its own
// round button at the right end (the residents' Track), which simply fills
// in when active. Screens pad their ends by useTabBarSpace() so the bar
// never covers their last item. The bar hides while the keyboard is open.
export function FloatingTabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  insets,
  separate,
}: BottomTabBarProps & { separate?: string }) {
  const { colors } = useTheme();
  const keyboard = useKeyboardHeight();
  const reportHeight = useContext(BottomTabBarHeightCallbackContext);

  const pillRoutes = state.routes.filter((route) => route.name !== separate);
  const active = pillRoutes.findIndex((route) => route.key === state.routes[state.index].key);
  const [pillWidth, setPillWidth] = useState(0);
  const slot = pillWidth ? (pillWidth - 2 * (border + padding) - gap * (pillRoutes.length - 1)) / pillRoutes.length : 0;

  // The highlight's place along the bar, and whether it shows (it fades out
  // while the separate round tab is the active one).
  const offset = useRef(new Animated.Value(0)).current;
  const shown = useRef(new Animated.Value(active >= 0 ? 1 : 0)).current;
  const placed = useRef(false);
  useEffect(() => {
    if (!slot) {
      return;
    }
    if (active >= 0) {
      const to = active * (slot + gap);
      if (placed.current) {
        Animated.spring(offset, { toValue: to, useNativeDriver: true, speed: 18, bounciness: 4 }).start();
      } else {
        offset.setValue(to);
        placed.current = true;
      }
    }
    Animated.timing(shown, { toValue: active >= 0 ? 1 : 0, duration: 160, useNativeDriver: true }).start();
  }, [active, slot, offset, shown]);

  if (keyboard > 0) {
    return null;
  }

  const tabs = state.routes.map((route, index) => {
    const { options } = descriptors[route.key];
    const focused = index === state.index;
    const label =
      options.tabBarAccessibilityLabel ??
      (typeof options.tabBarLabel === "string" ? options.tabBarLabel : (options.title ?? route.name));
    const badge = options.tabBarBadge;
    const color = focused ? colors.onPrimary : colors.text3;

    function onPress() {
      const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) {
        navigateToTab(route.key);
      }
    }

    const round = route.name === separate;
    return {
      round,
      element: (
        <Pressable
          key={route.key}
          accessibilityRole="tab"
          accessibilityState={{ selected: focused }}
          accessibilityLabel={label + (badge ? ", " + badge : "")}
          onPress={onPress}
          onLongPress={() => emitter.emit({ type: "tabLongPress", target: route.key })}
          style={({ pressed }) => [
            round ? [styles.round, { borderColor: colors.border }] : styles.item,
            {
              backgroundColor: round
                ? focused
                  ? pressed
                    ? colors.primaryPressed
                    : colors.primary
                  : pressed
                    ? colors.pressed
                    : colors.surface
                : pressed && !focused
                  ? colors.pressed
                  : "transparent",
            },
          ]}
        >
          {options.tabBarIcon?.({ focused, color, size: 21 })}
          {badge !== undefined ? (
            <View
              style={[
                styles.badge,
                { backgroundColor: focused ? colors.onPrimary : colors.primary, borderColor: focused ? colors.primary : colors.surface },
              ]}
            >
              <AppText style={styles.badgeText} color={focused ? colors.primary : colors.onPrimary} maxFontSizeMultiplier={1.2}>
                {badge}
              </AppText>
            </View>
          ) : null}
        </Pressable>
      ),
    };
  });

  return (
    <View
      style={[styles.bar, { paddingBottom: insets.bottom + 8 }]}
      accessibilityRole="tablist"
      pointerEvents="box-none"
      onLayout={(event) => reportHeight?.(event.nativeEvent.layout.height)}
    >
      <View
        style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onLayout={(event) => setPillWidth(event.nativeEvent.layout.width)}
      >
        {slot ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.highlight,
              { width: slot, backgroundColor: colors.primary, opacity: shown, transform: [{ translateX: offset }] },
            ]}
          />
        ) : null}
        {tabs.filter((tab) => !tab.round).map((tab) => tab.element)}
      </View>
      {tabs.filter((tab) => tab.round).map((tab) => tab.element)}
    </View>
  );
}

const height = 54;
const padding = 5;
const border = 1;
const gap = 4;
const itemHeight = height - 2 * (padding + border);

const styles = StyleSheet.create({
  // Drawn over the bottom of the screen with a clear background, so only the
  // bar itself shows.
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  pill: {
    flex: 1,
    flexDirection: "row",
    height,
    padding,
    gap,
    borderWidth: border,
    borderRadius: height / 2,
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  highlight: { position: "absolute", top: padding, left: padding, height: itemHeight, borderRadius: itemHeight / 2 },
  item: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: itemHeight / 2 },
  round: {
    width: height,
    height,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: border,
    borderRadius: height / 2,
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  badge: {
    position: "absolute",
    top: 6,
    left: "50%",
    marginLeft: 6,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderRadius: 9,
  },
  badgeText: { fontFamily: fonts.semibold, fontSize: 10, lineHeight: 12 },
});
