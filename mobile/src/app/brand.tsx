import { Redirect } from "expo-router";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Logotype } from "@/components/Logotype";
import { SeverityBadge } from "@/components/SeverityBadge";
import { StatusPill } from "@/components/StatusPill";
import { reportStatuses, severities } from "@/lib/reports";
import { brand, radius, useTheme } from "@/theme";

const scale = [900, 800, 700, 600, 500, 400, 300, 200, 150, 100] as const;

// Development-only sheet for checking the brand tokens in light and dark.
export default function BrandCheck() {
  const { colors } = useTheme();
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Section title="Logotype">
        <Logotype height={30} />
      </Section>

      <Section title="Road Orange">
        <View style={styles.swatches}>
          {scale.map((step) => (
            <View key={step} style={[styles.swatch, { backgroundColor: brand[step] }]} />
          ))}
        </View>
      </Section>

      <Section title="Type">
        <AppText variant="display">Report road damage</AppText>
        <AppText variant="title">Log in to ResQRoad</AppText>
        <AppText variant="heading">Deep pothole near the public market</AppText>
        <AppText>MacArthur Highway, Guinhawa, Malolos City</AppText>
        <AppText variant="caption">Reported 2 hours ago</AppText>
      </Section>

      <Section title="Buttons">
        <Button label="Submit report" />
        <Button label="Cancel" variant="secondary" />
        <Button label="Sending" loading />
      </Section>

      <Section title="Statuses">
        <View style={styles.wrap}>
          {reportStatuses.map((status) => (
            <StatusPill key={status} status={status} />
          ))}
        </View>
      </Section>

      <Section title="Severity">
        <View style={styles.wrap}>
          {severities.map((severity) => (
            <SeverityBadge key={severity} severity={severity} />
          ))}
        </View>
      </Section>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <AppText variant="eyebrow">RPT-1048</AppText>
        <AppText variant="heading">Deep pothole near the public market</AppText>
        <View style={styles.wrap}>
          <StatusPill status="in_progress" />
          <SeverityBadge severity="High" />
        </View>
      </View>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="eyebrow">{title}</AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { padding: 20, gap: 28 },
  section: { gap: 10 },
  swatches: { flexDirection: "row", borderRadius: radius.md, overflow: "hidden" },
  swatch: { flex: 1, height: 44 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: { gap: 8, padding: 16, borderWidth: 1, borderRadius: radius.lg },
});
