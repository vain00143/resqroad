import { Tabs } from "expo-router/js-tabs";
import type { ColorValue } from "react-native";

import { Icon, type IconName } from "@/components/Icon";
import { inTab, myJobs } from "@/lib/jobs";
import { useSession } from "@/lib/session";
import { fonts, useTheme } from "@/theme";

function tabIcon(name: IconName) {
  return function TabIcon({ color }: { color: ColorValue }) {
    return <Icon name={name} size={22} color={String(color)} />;
  };
}

export default function CrewLayout() {
  const { colors } = useTheme();
  const { user, reports } = useSession();
  const active = myJobs(reports, user?.id).filter((report) => inTab(report, "active")).length;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text3,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarBadgeStyle: { backgroundColor: colors.primary, fontFamily: fonts.semibold, fontSize: 10 },
        headerTitleStyle: { fontFamily: fonts.semibold },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", headerShown: false, tabBarIcon: tabIcon("home") }} />
      <Tabs.Screen
        name="jobs"
        options={{ title: "My jobs", tabBarIcon: tabIcon("wrench"), tabBarBadge: active || undefined }}
      />
      <Tabs.Screen name="map" options={{ title: "Repair sites", tabBarLabel: "Map", tabBarIcon: tabIcon("map") }} />
    </Tabs>
  );
}
