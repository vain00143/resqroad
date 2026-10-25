import { Link } from "expo-router";
import { useRef, useState } from "react";
import { StyleSheet, View, type TextInputInstance } from "react-native";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { FormScreen } from "@/components/FormScreen";
import { Icon } from "@/components/Icon";
import { Notice } from "@/components/Notice";
import { BuildInfo } from "@/components/BuildInfo";
import { ServerSettings } from "@/components/ServerSettings";
import { TextField } from "@/components/TextField";
import { WakingNotice } from "@/components/WakingNotice";
import { errorMessage, NetworkError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { fonts } from "@/theme";

export default function Login() {
  const { signIn, notice } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [unreachable, setUnreachable] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);

  async function submit() {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // On success the session switches to the resident or crew screens.
      await signIn(email.trim(), password);
    } catch (caught) {
      setError(errorMessage(caught));
      setUnreachable(caught instanceof NetworkError);
      setBusy(false);
    }
  }

  return (
    <FormScreen>
      <View style={styles.intro}>
        <AppText variant="eyebrow">Welcome back</AppText>
        <AppText variant="title">Log in to ResQRoad</AppText>
        <AppText variant="label" tone="text2">
          For residents and maintenance crews. Use the same account as the website.
        </AppText>
      </View>

      {notice ? <Notice message={notice} /> : null}
      <WakingNotice active={busy} />
      {error ? <Notice tone="error" message={error} /> : null}

      <TextField
        label="Email"
        icon="mail"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        label="Password"
        icon="lock"
        password
        value={password}
        onChangeText={setPassword}
        placeholder="Enter your password"
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Button
        label="Continue"
        size="lg"
        loading={busy}
        onPress={submit}
        icon={<Icon name="arrow-right" size={16} color="#FFFFFF" />}
      />

      <View style={styles.switch}>
        <AppText variant="label" tone="text2">
          New to ResQRoad?{" "}
        </AppText>
        <Link href="/register" replace>
          <AppText variant="label" tone="link" style={styles.strong}>
            Create a resident account
          </AppText>
        </Link>
      </View>

      {/* Only development builds can point the app at another server. */}
      {__DEV__ ? <ServerSettings unreachable={unreachable} /> : null}
      <BuildInfo />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 4, marginBottom: 2 },
  switch: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  strong: { fontFamily: fonts.semibold },
});
