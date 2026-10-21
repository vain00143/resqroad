import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";

// Stands in for screens that later build steps fill in.
export function Placeholder({ title, step }: { title: string; step: string }) {
  return (
    <View style={styles.root}>
      <AppText variant="eyebrow">{step}</AppText>
      <AppText variant="title">{title}</AppText>
      <AppText tone="text2">This screen is built in the next step.</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, gap: 8 },
});
