import { Tabs } from "expo-router/js-tabs";
import type { ColorValue } from "react-native";

import { FloatingTabBar } from "@/components/FloatingTabBar";
import { Icon, type IconName } from "@/components/Icon";
import { fonts, useTheme } from "@/theme";

function tabIcon(name: IconName) {
  return function TabIcon({ color }: { color: ColorValue }) {
    return <Icon name={name} size={21} color={String(color)} />;
  };
}

export default function ResidentLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} separate="track" />}
      screenOptions={{
        headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 16 },
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
