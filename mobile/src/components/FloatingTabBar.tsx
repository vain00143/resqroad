import type { BottomTabBarProps } from "expo-router/js-tabs";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { useKeyboardHeight } from "@/components/KeyboardAware";
import { fonts, useTheme } from "@/theme";

// The bottom tabs as a floating rounded bar: the active tab in a filled
// highlight, the others as muted icons. `separate` names a tab drawn as its
// own round button at the right end (the residents' Track). The bar sits
// below the screen rather than over it, so it never covers content, and
// hides while the keyboard is open.
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
              backgroundColor: focused
                ? pressed
                  ? colors.primaryPressed
                  : colors.primary
                : pressed
                  ? colors.pressed
                  : round
                    ? colors.surface
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
    <View style={[styles.bar, { paddingBottom: insets.bottom + 8, backgroundColor: colors.bg }]} accessibilityRole="tablist">
      <View style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {tabs.filter((tab) => !tab.round).map((tab) => tab.element)}
      </View>
      {tabs.filter((tab) => tab.round).map((tab) => tab.element)}
    </View>
  );
}

const height = 54;

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 6 },
  pill: {
    flex: 1,
    flexDirection: "row",
    height,
    padding: 5,
    gap: 4,
    borderWidth: 1,
    borderRadius: height / 2,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  item: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: (height - 10) / 2 },
  round: {
    width: height,
    height,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: height / 2,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
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
