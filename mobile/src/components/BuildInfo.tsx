import * as Application from "expo-application";
import Constants from "expo-constants";
import { StyleSheet } from "react-native";

import { AppText } from "@/components/AppText";

// "Version 1.0.0 (build 7) · commit 29fc595", so people can tell which build
// is installed. The build number is Android's versionCode, which EAS raises on
// every build; the commit comes from app.config.js.
export function buildLabel() {
  const version = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? "unknown";
  const build = Application.nativeBuildVersion;
  const commit = Constants.expoConfig?.extra?.commit;
  return (
    "Version " +
    version +
    (build ? " (build " + build + ")" : "") +
    (typeof commit === "string" && commit ? " · commit " + commit : "")
  );
}

export function BuildInfo() {
  return (
    <AppText variant="caption" selectable style={styles.text}>
      {buildLabel()}
    </AppText>
  );
}

const styles = StyleSheet.create({
  text: { textAlign: "center" },
});
