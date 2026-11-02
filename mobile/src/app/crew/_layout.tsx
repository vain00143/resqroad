import { Tabs } from "expo-router/js-tabs";
import type { ColorValue } from "react-native";

import { FloatingTabBar } from "@/components/FloatingTabBar";
import { Icon, type IconName } from "@/components/Icon";
import { inTab, myJobs } from "@/lib/jobs";
import { useSession } from "@/lib/session";
import { fonts, useTheme } from "@/theme";

function tabIcon(name: IconName) {
  return function TabIcon({ color }: { color: ColorValue }) {
    return <Icon name={name} size={21} color={String(color)} />;
  };
}

export default function CrewLayout() {
  const { colors } = useTheme();
  const { user, reports } = useSession();
  const active = myJobs(reports, user?.id).filter((report) => inTab(report, "active")).length;

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 16 },
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
