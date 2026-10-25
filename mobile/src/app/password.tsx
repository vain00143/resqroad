import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { StyleSheet, View, type TextInputInstance } from "react-native";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { FormScreen } from "@/components/FormScreen";
import { Notice } from "@/components/Notice";
import { TextField } from "@/components/TextField";
import { api, errorMessage } from "@/lib/api";

// Quick checks before sending; the server applies the same rules.
function problem(current: string, next: string, confirm: string): string | null {
  if (!current) {
    return "Enter your current password.";
  }
  if (next.length < 8 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) {
    return "Use at least 8 characters with a letter and a number.";
  }
  if (next === current) {
    return "Choose a password that's different from your current one.";
  }
  if (next !== confirm) {
    return "The new passwords don't match.";
  }
  return null;
}

// Changes the signed-in person's password. This phone stays signed in; the
// server signs out their other devices.
export default function ChangePassword() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const nextRef = useRef<TextInputInstance>(null);
  const confirmRef = useRef<TextInputInstance>(null);

  async function submit() {
    const found = problem(current, next, confirm);
    if (found) {
      setError(found);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/auth/password", { body: { currentPassword: current, newPassword: next } });
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <FormScreen>
        <Notice tone="success" message="Your password was changed. Other devices were signed out; this phone stays signed in." />
        <Button label="Done" size="lg" onPress={() => router.back()} />
      </FormScreen>
    );
  }

  return (
    <FormScreen>
      <View style={styles.intro}>
        <AppText variant="eyebrow">Account</AppText>
        <AppText variant="title">Change your password</AppText>
        <AppText tone="text2">You'll stay signed in on this phone. Your other devices will be signed out.</AppText>
      </View>

      {error ? <Notice tone="error" message={error} /> : null}

      <TextField
        label="Current password"
        icon="lock"
        password
        value={current}
        onChangeText={setCurrent}
        placeholder="Enter your current password"
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="next"
        onSubmitEditing={() => nextRef.current?.focus()}
      />
      <TextField
        ref={nextRef}
        label="New password"
        icon="lock"
        password
        value={next}
        onChangeText={setNext}
        placeholder="Create a new password"
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        hint="At least 8 characters with a letter and a number."
      />
      <TextField
        ref={confirmRef}
        label="Confirm new password"
        icon="lock"
        password
        value={confirm}
        onChangeText={setConfirm}
        placeholder="Type the new password again"
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Button label="Change password" size="lg" loading={busy} onPress={submit} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 6, marginBottom: 4 },
});
