import { Modal, Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Icon, type IconName } from "@/components/Icon";
import { radius, useTheme } from "@/theme";

type Props = {
  visible: boolean;
  icon: IconName;
  kicker: string;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

// The website's confirm dialog, as a bottom sheet: the icon beside the text,
// and the buttons underneath.
export function ConfirmDialog({
  visible,
  icon,
  kicker,
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: Props) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable accessibilityLabel="Close" style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onCancel} />
      <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
            <Icon name={icon} size={20} color={colors.primarySoftText} />
          </View>
          <View style={styles.text}>
            <AppText variant="eyebrow">{kicker}</AppText>
            <AppText variant="heading">{title}</AppText>
            <AppText variant="label" tone="text2">
              {message}
            </AppText>
          </View>
        </View>
        <View style={styles.actions}>
          <Button label={cancelLabel} variant="secondary" onPress={onCancel} style={styles.action} />
          <Button label={confirmLabel} onPress={onConfirm} style={styles.action} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: StyleSheet.absoluteFill,
  sheet: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 24,
    gap: 16,
    padding: 16,
    borderWidth: 1,
    borderRadius: radius.xl,
  },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  icon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.md },
  text: { flex: 1, gap: 2 },
  actions: { flexDirection: "row", gap: 10 },
  action: { flex: 1 },
});
