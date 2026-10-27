import { Link, Redirect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Logotype } from "@/components/Logotype";
import { Notice } from "@/components/Notice";
import { useSession } from "@/lib/session";
import { brand } from "@/theme";

// The first screen: the website's dark sign-in panel, with the headline up
// top and the two ways in right under its description.
export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { status, user, notice } = useSession();

  if (status === "signedIn" && user) {
    return <Redirect href={user.role === "maintenance" ? "/crew" : "/resident"} />;
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[styles.hero, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}
        bounces={false}
      >
        <Logotype onDark height={22} />
        <View style={styles.main}>
          <View style={styles.copy}>
            <AppText variant="display" color="#FFFFFF" style={styles.headline}>
              Keeping roads safe,{" "}
              <AppText variant="display" color={brand[500]} style={styles.headline}>
                together.
              </AppText>
            </AppText>
            <AppText variant="label" color="rgba(255, 255, 255, 0.7)" style={styles.description}>
              Report road damage in Bulacan and follow every repair, from your first photo to the crew's
              verified fix.
            </AppText>
          </View>

          {/* Why the last session ended, e.g. signed out elsewhere or deactivated. */}
          {notice ? <Notice message={notice} /> : null}
          <View style={styles.actions}>
            <Button label="Log in" size="lg" onPress={() => router.push("/login")} />
            <Button
              label="Create a resident account"
              variant="onDark"
              size="lg"
              onPress={() => router.push("/register")}
            />
            <Link href="/track" style={styles.trackLink}>
              <AppText variant="label" color={brand[300]}>
                Track a report by ID
              </AppText>
            </Link>
          </View>
        </View>
        {__DEV__ ? (
          <Link href="/brand" style={styles.devLink}>
            <AppText variant="caption" color="rgba(255, 255, 255, 0.5)">
              Brand check (development only)
            </AppText>
          </Link>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brand.ink },
  hero: {
    flexGrow: 1,
    paddingHorizontal: 22,
    // The website's sign-in panel: orange glow top right, burnt orange bottom left.
    backgroundImage:
      "radial-gradient(80% 60% at 100% 0%, rgba(207, 92, 54, 0.4), transparent 60%), " +
      "radial-gradient(70% 60% at 0% 100%, rgba(123, 54, 33, 0.5), transparent 60%)",
  },
  // The headline sits a little above the middle of the screen, with the
  // buttons set a little lower, apart from it.
  main: { flex: 1, justifyContent: "center", gap: 22, paddingBottom: "6%" },
  copy: { gap: 12 },
  headline: { fontSize: 32, lineHeight: 35 },
  description: { lineHeight: 20 },
  actions: { gap: 10, marginTop: 28 },
  trackLink: { alignSelf: "center", paddingVertical: 8 },
  devLink: { alignSelf: "center", paddingTop: 16 },
});
