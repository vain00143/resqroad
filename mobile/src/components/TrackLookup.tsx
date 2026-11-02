import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { FormScreen } from "@/components/FormScreen";
import { Icon } from "@/components/Icon";
import { Notice } from "@/components/Notice";
import { TextField } from "@/components/TextField";
import { api, ApiError, errorMessage } from "@/lib/api";
import { normalizeReportId, type Report } from "@/lib/reports";

// Look up any report by its ID, like the website's track page. Works signed
// in or out.
export function TrackLookup() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function track() {
    const id = normalizeReportId(value);
    if (!id) {
      setError("Enter a report ID such as RPT-1048.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { report } = await api<{ report: Report }>("/reports/" + id);
      router.push({ pathname: "/reports/[id]", params: { id: report.id } });
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 404
          ? "No report found with ID " + id + ". Check the number and try again."
          : errorMessage(caught),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormScreen>
      <View style={styles.intro}>
        <AppText variant="eyebrow">Track a report</AppText>
        <AppText variant="title">Where's my repair?</AppText>
        <AppText variant="label" tone="text2">
          Enter the report ID you got after reporting (for example RPT-1048) to see its progress.
        </AppText>
      </View>
      {error ? <Notice tone="error" message={error} /> : null}
      <TextField
        label="Report ID"
        icon="hash"
        value={value}
        onChangeText={setValue}
        placeholder="RPT-1048"
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={track}
      />
      <Button
        label="Track report"
        size="lg"
        loading={busy}
        onPress={track}
        icon={<Icon name="search" size={16} color="#FFFFFF" />}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 4, marginBottom: 2 },
});
