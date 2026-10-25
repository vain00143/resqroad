import { useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { errorMessage } from "@/lib/api";
import { addPhotos, type LocalPhoto } from "@/lib/photos";
import { radius, useTheme } from "@/theme";

const gap = 8;

// Camera and gallery buttons with removable thumbnails in a grid of
// `columns`, up to `max` photos (see photoLimits). `target` names the form
// the photos are for (see addPhotos).
export function PhotoPicker({
  photos,
  max,
  target,
  columns = 3,
  onChange,
  onError,
}: {
  photos: LocalPhoto[];
  max: number;
  target: string;
  columns?: number;
  onChange: (photos: LocalPhoto[]) => void;
  onError: (message: string) => void;
}) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState<"camera" | "library" | null>(null);
  const [width, setWidth] = useState(0);
  const room = max - photos.length;
  const size = width ? Math.floor((width - gap * (columns - 1)) / columns) : 0;

  async function add(source: "camera" | "library") {
    setBusy(source);
    try {
      const added = await addPhotos(source, room, target);
      if (added.length) {
        onChange([...photos, ...added].slice(0, max));
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
          icon={<Icon name="camera" size={16} color={colors.text} />}
          style={styles.button}
        />
        <Button
          label="Gallery"
          variant="secondary"
          disabled={room <= 0}
          loading={busy === "library"}
          onPress={() => add("library")}
          icon={<Icon name="image" size={16} color={colors.text} />}
          style={styles.button}
        />
      </View>
      {photos.length ? (
        <View style={styles.thumbs} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
          {photos.map((photo, index) => (
            <View
              key={photo.uri}
              style={[
                styles.thumb,
                size ? { width: size, height: size } : null,
                { borderColor: colors.border, backgroundColor: colors.surface3 },
              ]}
            >
              <Image source={{ uri: photo.uri }} style={styles.image} accessibilityLabel={photo.name} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={"Remove " + photo.name}
                hitSlop={8}
                onPress={() => onChange(photos.filter((_, i) => i !== index))}
                style={[styles.remove, { backgroundColor: colors.overlay }]}
              >
                <Icon name="x" size={12} color="#FFFFFF" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <AppText variant="caption">
        {photos.length} of {max} photos
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  buttons: { flexDirection: "row", gap: 8 },
  button: { flex: 1 },
  thumbs: { flexDirection: "row", flexWrap: "wrap", gap },
  thumb: { width: 68, height: 68, overflow: "hidden", borderWidth: 1, borderRadius: radius.sm },
  image: { width: "100%", height: "100%" },
  remove: {
    position: "absolute",
    top: 3,
    right: 3,
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
  },
});
