import { Link } from "expo-router";
import { useRef, useState } from "react";
import { StyleSheet, View, type TextInputInstance } from "react-native";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { FormScreen } from "@/components/FormScreen";
import { Notice } from "@/components/Notice";
import { ServerSettings } from "@/components/ServerSettings";
import { TextField } from "@/components/TextField";
import { WakingNotice } from "@/components/WakingNotice";
import { errorMessage, NetworkError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { fonts } from "@/theme";

const mismatch = "Passwords don't match.";

// Quick checks before sending; the server applies the same rules.
function problem(name: string, email: string, password: string): string | null {
  if (name.trim().length < 2) {
    return "Enter your full name.";
  }
  if (name.trim().length > 80) {
    return "Keep your name under 80 characters.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
    return "Enter a valid email address.";
  }
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Use at least 8 characters with a letter and a number.";
  }
  return null;
}

export default function Register() {
  const { register } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  // The mismatch shows once the confirm box has been left or the form sent,
  // not while the password is still being typed again.
  const [checkConfirm, setCheckConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [unreachable, setUnreachable] = useState(false);
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const confirmRef = useRef<TextInputInstance>(null);

  const confirmError = checkConfirm && confirm !== password ? mismatch : null;

  async function submit() {
    const found = problem(name, email, password);
    if (found) {
      setError(found);
      return;
    }
    setCheckConfirm(true);
    if (confirm !== password) {
      setError(null);
      confirmRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await register(name.trim(), email.trim(), password);
    } catch (caught) {
      setError(errorMessage(caught));
      setUnreachable(caught instanceof NetworkError);
      setBusy(false);
    }
  }

  return (
    <FormScreen>
      <View style={styles.intro}>
        <AppText variant="eyebrow">Free resident account</AppText>
        <AppText variant="title">Create your account</AppText>
        <AppText variant="label" tone="text2">
          Report road damage and follow every repair. The same account works on the website.
        </AppText>
      </View>

      <WakingNotice active={busy} />
      {error ? <Notice tone="error" message={error} /> : null}

      <TextField
        label="Full name"
        icon="user"
        value={name}
        onChangeText={setName}
        placeholder="Juana Dela Cruz"
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <TextField
        ref={emailRef}
        label="Email"
        icon="mail"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
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
        placeholder="Create a password"
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        hint="At least 8 characters with a letter and a number."
      />
      <TextField
        ref={confirmRef}
        label="Confirm password"
        icon="lock"
        password
        value={confirm}
        onChangeText={setConfirm}
        onBlur={() => confirm && setCheckConfirm(true)}
        placeholder="Type the password again"
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
        error={confirmError}
      />
      <Button label="Create account" size="lg" loading={busy} onPress={submit} />

      <View style={styles.switch}>
        <AppText variant="label" tone="text2">
          Already have an account?{" "}
        </AppText>
        <Link href="/login" replace>
          <AppText variant="label" tone="link" style={styles.strong}>
            Log in
          </AppText>
        </Link>
      </View>

      {/* Only development builds can point the app at another server. */}
      {__DEV__ ? <ServerSettings unreachable={unreachable} /> : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 4, marginBottom: 2 },
  switch: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  strong: { fontFamily: fonts.semibold },
});
