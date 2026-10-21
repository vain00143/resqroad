import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";

import { SessionProvider, useSession } from "@/lib/session";
import { fonts, useTheme } from "@/theme";
import { fontFiles } from "@/theme/fonts";

// Keep the splash screen up until the fonts and the saved sign-in are ready.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts(fontFiles);
  if (!loaded && !error) {
    return null;
  }
  return (
    <SessionProvider>
      <RootNavigator />
    </SessionProvider>
  );
}

function RootNavigator() {
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
          headerTitleStyle: { fontFamily: fonts.semibold },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        {/* The welcome screen sends signed-in people to their own home. */}
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Protected guard={status === "signedOut"}>
          <Stack.Screen name="login" options={{ title: "Log in" }} />
          <Stack.Screen name="register" options={{ title: "Create an account" }} />
        </Stack.Protected>
        <Stack.Protected guard={user?.role === "citizen"}>
          <Stack.Screen name="resident" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={user?.role === "maintenance"}>
          <Stack.Screen name="crew" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Screen name="track" options={{ title: "Track a report" }} />
        <Stack.Screen name="brand" options={{ title: "Brand check" }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
