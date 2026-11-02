import { useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { photoUri, type LocalPhoto } from "@/lib/photos";
import type { Photo } from "@/lib/reports";
import { fonts, radius, useTheme } from "@/theme";

type Item = { key: string; uri: string | null; name: string };

// Uploaded photos, photos still on the phone, or sample file names (which
// have no image to show).
function toItems(photos: (Photo | LocalPhoto)[]): Item[] {
  return photos.map((photo, index) => {
    if (typeof photo === "string") {
      return { key: photo + index, uri: null, name: photo };
    }
    const uri = "uri" in photo ? photo.uri : photoUri(photo);
    return { key: (uri ?? photo.name) + index, uri, name: photo.name };
  });
}

// Photos in one tidy frame whatever their number or orientation, like the
// website's gallery: every photo is cropped to fill its tile. One photo fills
// the width, two sit side by side, and three or more are one large and two
// stacked, with "+N" on the third for the photos past it. Tapping a tile opens
// the whole photo, uncropped, and the viewer swipes between them. `captions`
// labels each photo on its tile (such as "Before" and "After").
export function PhotoGallery({
  photos,
  label,
  captions,
}: {
  photos: (Photo | LocalPhoto)[];
  label?: string;
  captions?: string[];
}) {
  const { colors } = useTheme();
  const items = toItems(photos);
  const [open, setOpen] = useState<number | null>(null);

  if (!items.length) {
    return null;
  }

  function tile(index: number, style: ViewStyle, more = 0) {
    const item = items[index];
    return (
      <Pressable
        key={item.key}
        accessibilityRole="imagebutton"
        accessibilityLabel={
          (captions?.[index] ? captions[index] + ": " : "") +
          (item.uri ? "Open photo " + (index + 1) + " of " + items.length : "Sample photo " + item.name)
        }
        disabled={!item.uri}
        onPress={() => setOpen(index)}
        style={[styles.tile, { backgroundColor: colors.surface3 }, style]}
      >
        {item.uri ? (
          <Image source={{ uri: item.uri }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Icon name="image" size={22} />
            <AppText variant="caption" numberOfLines={1}>
              Sample photo
            </AppText>
          </View>
        )}
        {captions?.[index] ? (
          <View style={styles.caption} pointerEvents="none">
            <AppText variant="caption" style={styles.captionText} color="#FFFFFF">
              {captions[index]}
            </AppText>
          </View>
        ) : null}
        {more > 0 ? (
          <View style={styles.more}>
            <AppText style={styles.moreText} color="#FFFFFF">
              +{more}
            </AppText>
          </View>
        ) : null}
      </Pressable>
    );
  }

  const count = items.length;
  let layout;
  if (count === 1) {
    layout = <View style={styles.single}>{tile(0, styles.fill)}</View>;
  } else if (count === 2) {
    layout = (
      <View style={styles.pair}>
        {tile(0, styles.fill)}
        {tile(1, styles.fill)}
      </View>
    );
  } else {
    layout = (
      <View style={styles.trio}>
        {tile(0, styles.large)}
        <View style={styles.column}>
          {tile(1, styles.fill)}
          {tile(2, styles.fill, count - 3)}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {label ? (
        <View style={styles.head}>
          <AppText variant="label" tone="heading">
            {label}
          </AppText>
          <AppText variant="caption">
            {count} {count === 1 ? "photo" : "photos"} · tap to enlarge
          </AppText>
        </View>
      ) : null}
      {layout}
      <PhotoViewer items={items} index={open} onClose={() => setOpen(null)} />
    </View>
  );
}

// The photos full screen, uncropped; swipe sideways for the others.
function PhotoViewer({ items, index, onClose }: { items: Item[]; index: number | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const shown = items.filter((item) => item.uri);
  const [current, setCurrent] = useState(0);
  const start = index === null ? 0 : Math.max(0, shown.indexOf(items[index]));

  return (
    <Modal
      visible={index !== null}
      animationType="fade"
      onRequestClose={onClose}
      onShow={() => setCurrent(start)}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.viewer}>
        <FlatList
          data={shown}
          keyExtractor={(item) => item.key}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={start}
          getItemLayout={(_, itemIndex) => ({ length: width, offset: width * itemIndex, index: itemIndex })}
          onMomentumScrollEnd={(event) => setCurrent(Math.round(event.nativeEvent.contentOffset.x / width))}
          renderItem={({ item, index: itemIndex }) => (
            <Image
              source={{ uri: item.uri ?? undefined }}
              style={{ width, height }}
              resizeMode="contain"
              accessibilityLabel={"Photo " + (itemIndex + 1) + " of " + shown.length}
            />
          )}
        />
        {shown.length > 1 ? (
          <View style={[styles.counter, { top: insets.top + 22 }]} pointerEvents="none">
            <AppText variant="label" color="#FFFFFF">
              {current + 1} / {shown.length}
            </AppText>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close photo"
          onPress={onClose}
          style={[styles.close, { top: insets.top + 12 }]}
        >
          <Icon name="x" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </Modal>
  );
}

const gap = 4;

const styles = StyleSheet.create({
  root: { gap: 8 },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  // The frames: a fixed shape for each number of photos.
  single: { aspectRatio: 16 / 10 },
  pair: { flexDirection: "row", gap, aspectRatio: 2 },
  trio: { flexDirection: "row", gap, aspectRatio: 3 / 2 },
  column: { flex: 1, gap },
  tile: { overflow: "hidden", borderRadius: radius.sm },
  fill: { flex: 1 },
  large: { flex: 2 },
  image: { width: "100%", height: "100%" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, padding: 8 },
  more: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0, 0, 0, 0.5)" },
  moreText: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26 },
  // Like the website's before and after labels.
  caption: {
    position: "absolute",
    left: 6,
    bottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: "rgba(14, 11, 10, 0.72)",
  },
  captionText: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 15 },
  viewer: { flex: 1, backgroundColor: "#000000" },
  counter: { position: "absolute", alignSelf: "center" },
  close: {
    position: "absolute",
    right: 12,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
  },
});
