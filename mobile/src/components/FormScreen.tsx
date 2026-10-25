import type { ReactNode } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardAware } from "@/components/KeyboardAware";

// A scrolling screen that keeps the focused field above the keyboard.
export function FormScreen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAware style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </KeyboardAware>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, gap: 14 },
});
