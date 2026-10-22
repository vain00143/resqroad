import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { Notice } from "@/components/Notice";
import { TextField } from "@/components/TextField";
import { api, errorMessage, isHostedServer, normalizeServerUrl } from "@/lib/api";
import { useSession } from "@/lib/session";
import { radius, useTheme } from "@/theme";

// The app uses the hosted server by default; for testing it can point at a
// laptop on the same Wi-Fi instead, so the address can be changed and tested
// from the sign-in screens. `unreachable` opens it when signing in couldn't
// reach the server.
export function ServerSettings({ unreachable = false }: { unreachable?: boolean }) {
  const { colors } = useTheme();
  const { serverUrl, setServerUrl } = useSession();
  const [open, setOpen] = useState(!serverUrl);
  const [address, setAddress] = useState(serverUrl);

  useEffect(() => {
    if (unreachable) {
      setOpen(true);
    }
  }, [unreachable]);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function test() {
    const url = normalizeServerUrl(address);
    if (!url) {
      setResult({ ok: false, message: "Enter the server address shown when the server starts." });
      return;
    }
    setTesting(true);
    setResult(null);
    try {
      // A sleeping hosted server can take about a minute to answer.
      await api("/health", { baseUrl: url, token: null, timeoutMs: isHostedServer(url) ? 90000 : 8000 });
      await setServerUrl(url);
      setAddress(url);
      setResult({ ok: true, message: "Connected to " + url + "." });
    } catch (error) {
      setResult({ ok: false, message: errorMessage(error) });
    } finally {
      setTesting(false);
    }
  }

  return (
    <View style={[styles.box, { borderColor: colors.border, backgroundColor: colors.surface2 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={styles.header}
      >
        <Icon name="smartphone" size={18} />
        <View style={styles.headerText}>
          <AppText variant="label" tone="heading">
            Server settings
          </AppText>
          <AppText variant="caption" numberOfLines={1}>
            {serverUrl || "No server address yet"}
          </AppText>
        </View>
        <Icon name={open ? "chevron-up" : "chevron-down"} size={18} />
      </Pressable>
      {open ? (
        <View style={styles.body}>
          <TextField
            label="Server address"
            icon="external-link"
            value={address}
            onChangeText={(text) => {
              setAddress(text);
              setResult(null);
            }}
            placeholder="https://resqroad.onrender.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="done"
            onSubmitEditing={test}
            hint="Usually https://resqroad.onrender.com. For a server on a laptop, use the address it prints when it starts; your phone must be on the same Wi-Fi."
          />
          <Button label="Save and test connection" variant="secondary" loading={testing} onPress={test} />
          {result ? <Notice tone={result.ok ? "success" : "error"} message={result.message} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.lg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  headerText: { flex: 1 },
  body: { gap: 12, paddingHorizontal: 14, paddingBottom: 14 },
});
