import { useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { errorMessage } from "@/lib/api";
import { addPhotos, maxPhotos, type LocalPhoto } from "@/lib/photos";
import { radius, useTheme } from "@/theme";

// Camera and gallery buttons with removable thumbnails (up to five photos).
// `target` names the form the photos are for (see addPhotos).
export function PhotoPicker({
  photos,
  target,
  onChange,
  onError,
}: {
  photos: LocalPhoto[];
  target: string;
  onChange: (photos: LocalPhoto[]) => void;
  onError: (message: string) => void;
}) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState<"camera" | "library" | null>(null);
  const room = maxPhotos - photos.length;

  async function add(source: "camera" | "library") {
    setBusy(source);
    try {
      const added = await addPhotos(source, room, target);
      if (added.length) {
        onChange([...photos, ...added].slice(0, maxPhotos));
      }
    } catch (error) {
      onError(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.buttons}>
        <Button
          label="Take photo"
          variant="secondary"
          disabled={room <= 0}
          loading={busy === "camera"}
          onPress={() => add("camera")}
          icon={<Icon name="camera" size={18} color={colors.text} />}
          style={styles.button}
        />
        <Button
          label="Gallery"
          variant="secondary"
          disabled={room <= 0}
          loading={busy === "library"}
          onPress={() => add("library")}
          icon={<Icon name="image" size={18} color={colors.text} />}
          style={styles.button}
        />
      </View>
      {photos.length ? (
        <View style={styles.thumbs}>
          {photos.map((photo, index) => (
            <View key={photo.uri} style={[styles.thumb, { borderColor: colors.border }]}>
              <Image source={{ uri: photo.uri }} style={styles.image} accessibilityLabel={photo.name} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={"Remove " + photo.name}
                hitSlop={8}
                onPress={() => onChange(photos.filter((_, i) => i !== index))}
                style={[styles.remove, { backgroundColor: colors.overlay }]}
              >
                <Icon name="x" size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <AppText variant="caption">
        {photos.length} of {maxPhotos} photos
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  buttons: { flexDirection: "row", gap: 10 },
  button: { flex: 1 },
  thumbs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  thumb: { width: 76, height: 76, overflow: "hidden", borderWidth: 1, borderRadius: radius.md },
  image: { width: "100%", height: "100%" },
  remove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
});
