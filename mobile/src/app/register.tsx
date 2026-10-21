import { Link } from "expo-router";
import { useRef, useState } from "react";
import { StyleSheet, View, type TextInputInstance } from "react-native";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { FormScreen } from "@/components/FormScreen";
import { Notice } from "@/components/Notice";
import { ServerSettings } from "@/components/ServerSettings";
import { TextField } from "@/components/TextField";
import { errorMessage } from "@/lib/api";
import { useSession } from "@/lib/session";

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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);

  async function submit() {
    const found = problem(name, email, password);
    if (found) {
      setError(found);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await register(name.trim(), email.trim(), password);
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <FormScreen>
      <View style={styles.intro}>
        <AppText variant="eyebrow">Free resident account</AppText>
        <AppText variant="title">Create your account</AppText>
        <AppText tone="text2">
          Report road damage and follow every repair. The same account works on the website.
        </AppText>
      </View>

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
        returnKeyType="go"
        onSubmitEditing={submit}
        hint="At least 8 characters with a letter and a number."
      />
      <Button label="Create account" size="lg" loading={busy} onPress={submit} />

      <View style={styles.switch}>
        <AppText tone="text2">Already have an account? </AppText>
        <Link href="/login" replace>
          <AppText variant="bodyStrong" tone="link">
            Log in
          </AppText>
        </Link>
      </View>

      <ServerSettings />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 6, marginBottom: 4 },
  switch: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
});
