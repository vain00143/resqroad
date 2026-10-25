import { View } from "react-native";

import { AppText } from "@/components/AppText";
import { labelStyles as styles } from "@/components/StatusPill";
import type { Severity } from "@/lib/reports";
import { severityLabelColors } from "@/theme";

// The website's solid severity label (`.sev`).
export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <View style={[styles.label, { backgroundColor: severityLabelColors[severity] }]}>
      <AppText variant="caption" style={styles.text} color="#FFFFFF" numberOfLines={1}>
        {severity}
      </AppText>
    </View>
  );
}
