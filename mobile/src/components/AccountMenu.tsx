import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/AppText";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Icon, type IconName } from "@/components/Icon";
import { useSession } from "@/lib/session";
import { fonts, radius, useTheme, useThemeChoice, type ThemeChoice } from "@/theme";

const themes: { value: ThemeChoice; label: string; icon: IconName }[] = [
  { value: "system", label: "System", icon: "smartphone" },
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
];

// "Juana Dela Cruz" → "JC". Accounts have no photos; the website shows
// initials too.
export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) {
    return "?";
  }
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}

// The signed-in person's initials, top right of the home screen. Tapping it
// opens a small menu: change password, the theme, and log out.
export function AccountMenu() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useSession();
  const { choice, setChoice } = useThemeChoice();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // Log out was chosen: its confirmation opens once the menu has faded out,
  // because Android doesn't show a dialog that opens while another closes.
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (open || !loggingOut) {
      return;
    }
    const timer = setTimeout(() => {
      setLoggingOut(false);
      setConfirming(true);
    }, 350);
    return () => clearTimeout(timer);
  }, [open, loggingOut]);
  const name = user?.name ?? "";

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={"Account menu for " + name}
        accessibilityState={{ expanded: open }}
        hitSlop={6}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.avatar, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
      >
        <AppText style={styles.avatarText} color="#FFFFFF" maxFontSizeMultiplier={1.2}>
          {initials(name)}
        </AppText>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityLabel="Close menu" style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
        <View
          style={[styles.menu, { top: insets.top + 52, backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityViewIsModal
        >
          <View style={styles.person}>
            <AppText variant="label" tone="heading" numberOfLines={1}>
              {name}
            </AppText>
            <AppText variant="caption" numberOfLines={1}>
              {user?.email}
            </AppText>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <MenuItem
            icon="lock"
            label="Change password"
            onPress={() => {
              setOpen(false);
              router.push("/password");
            }}
          />

          <View style={styles.themeBlock}>
            <AppText variant="caption" tone="text2">
              Theme
            </AppText>
            <View
              style={[styles.segments, { backgroundColor: colors.surface3 }]}
              accessibilityRole="radiogroup"
              accessibilityLabel="Theme"
            >
              {themes.map((theme) => {
                const selected = choice === theme.value;
                return (
                  <Pressable
                    key={theme.value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={theme.label + " theme"}
                    onPress={() => setChoice(theme.value)}
                    style={[styles.segment, selected && [styles.segmentOn, { backgroundColor: colors.surface }]]}
                  >
                    <Icon name={theme.icon} size={13} color={selected ? colors.accent : colors.text3} />
                    <AppText
                      variant="caption"
                      tone={selected ? "heading" : "text3"}
                      numberOfLines={1}
                      // Three choices share one row, so they grow less with large text.
                      maxFontSizeMultiplier={1.15}
                      style={selected && styles.on}
                    >
                      {theme.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <MenuItem
            icon="log-out"
            label="Log out"
            onPress={() => {
              setOpen(false);
              setLoggingOut(true);
            }}
          />
        </View>
      </Modal>

      <ConfirmDialog
        visible={confirming}
        icon="log-out"
        kicker="Account"
        title="Log out of ResQRoad?"
        message="You'll need to sign in again to get back to your account."
        confirmLabel="Log out"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          signOut();
        }}
      />
    </>
  );
}

function MenuItem({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.pressed }]}
    >
      <Icon name={icon} size={16} color={colors.text2} />
      <AppText variant="label" tone="heading">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17 },
  avatarText: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 16, letterSpacing: 0.3 },
  menu: {
    position: "absolute",
    right: 12,
    width: 248,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: radius.lg,
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  person: { gap: 1, paddingHorizontal: 14, paddingTop: 6, paddingBottom: 8 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  item: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 40, paddingHorizontal: 14 },
  themeBlock: { gap: 6, paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8 },
  segments: { flexDirection: "row", padding: 3, borderRadius: radius.sm },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minHeight: 30,
    borderRadius: radius.xs,
  },
  segmentOn: {
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  on: { fontFamily: fonts.semibold },
});
