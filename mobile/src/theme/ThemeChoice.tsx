// The app's light or dark look: the phone's own setting by default, or the
// choice made in the avatar menu, saved on the phone.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Appearance, useColorScheme } from "react-native";

import { colors, statusColors, type ColorScheme } from "./tokens";

export type ThemeChoice = "system" | "light" | "dark";

const storageKey = "resqroad.theme";

type ThemeChoiceState = { choice: ThemeChoice; setChoice: (choice: ThemeChoice) => void };

const ThemeChoiceContext = createContext<ThemeChoiceState>({ choice: "system", setChoice: () => {} });

// Also tells Android, so its own dialogs and pickers match the app.
function applyToSystem(choice: ThemeChoice) {
  if (typeof Appearance.setColorScheme === "function") {
    Appearance.setColorScheme(choice === "system" ? "unspecified" : choice);
  }
}

export function ThemeChoiceProvider({ children }: { children: ReactNode }) {
  // Null until the saved choice is read, so the first screen has the right colors.
  const [choice, setChoiceState] = useState<ThemeChoice | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(storageKey)
      .catch(() => null)
      .then((saved) => {
        const value: ThemeChoice = saved === "light" || saved === "dark" ? saved : "system";
        if (value !== "system") {
          applyToSystem(value);
        }
        setChoiceState(value);
      });
  }, []);

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    applyToSystem(next);
    AsyncStorage.setItem(storageKey, next).catch(() => {});
  }, []);

  const value = useMemo(() => ({ choice: choice ?? "system", setChoice }), [choice, setChoice]);
  return choice === null ? null : <ThemeChoiceContext.Provider value={value}>{children}</ThemeChoiceContext.Provider>;
}

export function useThemeChoice() {
  return useContext(ThemeChoiceContext);
}

export function useTheme() {
  const system = useColorScheme();
  const { choice } = useContext(ThemeChoiceContext);
  const scheme: ColorScheme = choice === "system" ? (system === "dark" ? "dark" : "light") : choice;
  return { scheme, colors: colors[scheme], statusColors: statusColors[scheme] };
}
