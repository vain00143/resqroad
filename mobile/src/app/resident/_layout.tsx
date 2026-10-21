import { Tabs } from "expo-router/js-tabs";
import type { ColorValue } from "react-native";

import { Icon, type IconName } from "@/components/Icon";
import { fonts, useTheme } from "@/theme";

function tabIcon(name: IconName) {
  return function TabIcon({ color }: { color: ColorValue }) {
    return <Icon name={name} size={22} color={String(color)} />;
  };
}

export default function ResidentLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text3,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        headerTitleStyle: { fontFamily: fonts.semibold },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", headerShown: false, tabBarIcon: tabIcon("home") }} />
      <Tabs.Screen name="report" options={{ title: "Report a problem", tabBarLabel: "Report", tabBarIcon: tabIcon("camera") }} />
      <Tabs.Screen name="reports" options={{ title: "My reports", tabBarIcon: tabIcon("clipboard-list") }} />
      <Tabs.Screen name="track" options={{ title: "Track a report", tabBarLabel: "Track", tabBarIcon: tabIcon("search") }} />
    </Tabs>
  );
}
