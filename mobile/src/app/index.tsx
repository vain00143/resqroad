import { Link, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Logotype } from "@/components/Logotype";
import { brand, radius, useTheme } from "@/theme";

// The first screen: the same dark brand panel as the website's sign-in page,
// with the sign-in choices on a sheet that follows the phone's theme.
export default function Welcome() {
  const { scheme, colors } = useTheme();
  const insets = useSafeAreaInsets();
  // In dark mode the sheet is nearly as dark as the panel, so outline it.
  const sheetEdge = scheme === "dark" ? colors.borderStrong : "transparent";

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={[styles.hero, { paddingTop: insets.top + 28 }]} bounces={false}>
        <Logotype onDark height={28} />
        <View style={styles.copy}>
          <AppText variant="display" color="#FFFFFF" style={styles.headline}>
            Keeping roads safe,{" "}
            <AppText variant="display" color={brand[500]} style={styles.headline}>
              together.
            </AppText>
          </AppText>
          <AppText color="rgba(255, 255, 255, 0.68)">
            Report road damage in Bulacan and follow every repair, from your first photo to the crew's
            verified fix.
          </AppText>
        </View>
        <View style={styles.points}>
          <Point title="Residents" text="Report road damage and follow every repair." />
          <Point title="Maintenance crews" text="See your assigned jobs and submit completed repairs." />
        </View>
      </ScrollView>

      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.surface, borderColor: sheetEdge, paddingBottom: insets.bottom + 20 },
        ]}
      >
        <Button label="Log in" size="lg" onPress={() => router.push("/login")} />
        <Button
          label="Create a resident account"
          variant="secondary"
          size="lg"
          onPress={() => router.push("/register")}
        />
        <Link href="/track" style={styles.trackLink}>
          <AppText variant="label" tone="link">
            Track a report by ID
          </AppText>
        </Link>
        {__DEV__ ? (
          <Link href="/brand" style={styles.devLink}>
            <AppText variant="caption">Brand check (development only)</AppText>
          </Link>
        ) : null}
      </View>
    </View>
  );
}

function Point({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.point}>
      <View style={styles.pointMark} />
      <View style={styles.pointText}>
        <AppText variant="bodyStrong" color="#FFFFFF">
          {title}
        </AppText>
        <AppText variant="caption" color="rgba(255, 255, 255, 0.6)">
          {text}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brand.ink },
  hero: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 32,
    // The website's sign-in panel: orange glow top right, burnt orange bottom left.
    backgroundImage:
      "radial-gradient(80% 60% at 100% 0%, rgba(207, 92, 54, 0.4), transparent 60%), " +
      "radial-gradient(70% 60% at 0% 100%, rgba(123, 54, 33, 0.5), transparent 60%)",
  },
  copy: { gap: 14, marginTop: "auto" },
  headline: { fontSize: 34, lineHeight: 37 },
  points: { gap: 14 },
  point: { flexDirection: "row", gap: 12 },
  pointMark: { width: 4, borderRadius: 2, backgroundColor: brand[600] },
  pointText: { flex: 1, gap: 2 },
  sheet: {
    gap: 12,
    paddingTop: 24,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  trackLink: { alignSelf: "center", paddingVertical: 8 },
  devLink: { alignSelf: "center" },
});
