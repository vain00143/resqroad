import { useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { photoUri } from "@/lib/photos";
import type { Photo } from "@/lib/reports";
import { radius, useTheme } from "@/theme";

// A row of report photos; tapping one opens it full screen.
export function PhotoGallery({ photos, label }: { photos: Photo[]; label: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState<string | null>(null);

  return (
    <View style={styles.root}>
      <AppText variant="label" tone="heading">
        {label}
      </AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {photos.map((photo, index) => {
          const uri = photoUri(photo);
          const name = typeof photo === "string" ? photo : photo.name;
          return uri ? (
            <Pressable
              key={uri}
              accessibilityRole="imagebutton"
              accessibilityLabel={"Open photo " + (index + 1) + " of " + photos.length}
              onPress={() => setOpen(uri)}
            >
              <Image source={{ uri }} style={[styles.thumb, { backgroundColor: colors.surfaceSunken }]} />
            </Pressable>
          ) : (
            <View
              key={name + index}
              accessibilityLabel={"Sample photo " + name}
              style={[styles.thumb, styles.placeholder, { backgroundColor: colors.surfaceSunken }]}
            >
              <Icon name="image" size={24} />
              <AppText variant="caption" numberOfLines={1} style={styles.placeholderText}>
                Sample photo
              </AppText>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={open !== null} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <View style={styles.viewer}>
          {open ? <Image source={{ uri: open }} style={styles.full} resizeMode="contain" /> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close photo"
            onPress={() => setOpen(null)}
            style={[styles.close, { top: insets.top + 12 }]}
          >
            <Icon name="x" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  row: { gap: 8 },
  thumb: { width: 120, height: 96, borderRadius: radius.md },
  placeholder: { alignItems: "center", justifyContent: "center", gap: 4, padding: 8 },
  placeholderText: { textAlign: "center" },
  viewer: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.92)", justifyContent: "center" },
  full: { width: "100%", height: "80%" },
  close: {
    position: "absolute",
    right: 16,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
  },
});
