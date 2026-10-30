import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, type Href } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";

import { UpdateBanner } from "@/components/UpdateBanner";
import { SessionProvider, useSession } from "@/lib/session";
import { onNotificationTap, setUpNotifications } from "@/lib/updates";
import { fonts, ThemeChoiceProvider, useTheme } from "@/theme";
import { fontFiles } from "@/theme/fonts";

// Keep the splash screen up until the fonts, the theme choice, and the saved
// sign-in are ready.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts(fontFiles);
  if (!loaded && !error) {
    return null;
  }
  return (
    <ThemeChoiceProvider>
      <SessionProvider>
        <RootNavigator />
      </SessionProvider>
    </ThemeChoiceProvider>
  );
}

function RootNavigator() {
  const router = useRouter();
  const { scheme, colors } = useTheme();
  const { status, user } = useSession();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg);
  }, [colors.bg]);

  useEffect(() => {
    if (status !== "loading") {
      SplashScreen.hide();
    }
  }, [status]);

  // Status notifications: ask once signed in, and open the report or job
  // when one is tapped.
  useEffect(() => {
    if (status === "signedIn") {
      setUpNotifications().catch(() => {});
    }
  }, [status]);
  useEffect(() => onNotificationTap((path) => router.push(path as Href)), [router]);

  if (status === "loading") {
    return null;
  }

  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.bg,
      card: colors.surface,
      text: colors.heading,
      border: colors.border,
      notification: colors.accent,
    },
    fonts: {
      regular: { fontFamily: fonts.regular, fontWeight: "400" as const },
      medium: { fontFamily: fonts.medium, fontWeight: "400" as const },
      bold: { fontFamily: fonts.semibold, fontWeight: "400" as const },
      heavy: { fontFamily: fonts.bold, fontWeight: "400" as const },
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 16 },
          contentStyle: { backgroundColor: colors.bg },
          // Pages such as a report slide in from the right, and back out to it.
          animation: "slide_from_right",
        }}
      >
        {/* The welcome screen sends signed-in people to their own home. */}
        <Stack.Screen name="index" options={{ headerShown: false }} />
        {/* The page's own heading names these, so the bar only has the back arrow. */}
        <Stack.Protected guard={status === "signedOut"}>
          <Stack.Screen
            name="login"
            options={{ title: "Log in", headerTitle: "", headerStyle: { backgroundColor: colors.bg } }}
          />
          <Stack.Screen
            name="register"
            options={{ title: "Create an account", headerTitle: "", headerStyle: { backgroundColor: colors.bg } }}
          />
        </Stack.Protected>
        <Stack.Protected guard={user?.role === "citizen"}>
          <Stack.Screen name="resident" options={{ headerShown: false }} />
          {/* Rises from the bottom, like the website's feedback dialog on phones. */}
          <Stack.Screen
            name="feedback/[id]"
            options={{ title: "Repair feedback", headerBackTitle: "Back", animation: "slide_from_bottom" }}
          />
        </Stack.Protected>
        <Stack.Protected guard={user?.role === "maintenance"}>
          <Stack.Screen name="crew" options={{ headerShown: false }} />
          <Stack.Screen name="jobs/[id]" options={{ title: "Job", headerBackTitle: "Back" }} />
        </Stack.Protected>
        <Stack.Protected guard={status === "signedIn"}>
          <Stack.Screen name="password" options={{ title: "Change password", headerBackTitle: "Back" }} />
        </Stack.Protected>
        <Stack.Screen name="track" options={{ title: "Track a report" }} />
        <Stack.Screen name="reports/[id]" options={{ title: "Report", headerBackTitle: "Back" }} />
        <Stack.Screen name="brand" options={{ title: "Brand check" }} />
      </Stack>
      <UpdateBanner />
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
    </ThemeProvider>
  );
}
