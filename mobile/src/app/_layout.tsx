import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";

import { fonts, useTheme } from "@/theme";
import { fontFiles } from "@/theme/fonts";

// Keep the splash screen up until the brand fonts are ready.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts(fontFiles);
  const { scheme, colors } = useTheme();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg);
  }, [colors.bg]);

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hide();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
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
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: "Log in" }} />
        <Stack.Screen name="register" options={{ title: "Create an account" }} />
        <Stack.Screen name="track" options={{ title: "Track a report" }} />
        <Stack.Screen name="brand" options={{ title: "Brand check" }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
