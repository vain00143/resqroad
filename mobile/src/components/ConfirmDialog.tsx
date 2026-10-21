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
  onConfirm: () => void;
  onCancel: () => void;
};

// The website's confirm dialog, as a bottom sheet.
export function ConfirmDialog({ visible, icon, kicker, title, message, confirmLabel, onConfirm, onCancel }: Props) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable accessibilityLabel="Close" style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onCancel} />
      <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <Icon name={icon} size={22} color={colors.primarySoftText} />
        </View>
        <AppText variant="eyebrow">{kicker}</AppText>
        <AppText variant="heading">{title}</AppText>
        <AppText tone="text2">{message}</AppText>
        <View style={styles.actions}>
          <Button label="Cancel" variant="secondary" onPress={onCancel} style={styles.action} />
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
    gap: 6,
    padding: 20,
    borderWidth: 1,
    borderRadius: radius.xl,
  },
  icon: {
    width: 44,
    height: 44,
    marginBottom: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
  },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  action: { flex: 1 },
});
