import { useEffect, useState, type ReactNode } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// How much of the screen the on-screen keyboard covers (0 while it's closed).
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", (event) => setHeight(event.endCoordinates.height));
    const hidden = Keyboard.addListener("keyboardDidHide", () => setHeight(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return height;
}

// Keeps a screen's content, and its bottom buttons, above the keyboard. The
// app is drawn edge to edge on Android, so the keyboard covers the bottom of
// the screen instead of shrinking it, and React Native's KeyboardAvoidingView
// misjudges the overlap below a header; the screen pads itself by the
// keyboard's height instead. React Native leaves the navigation bar out of
// that height, so it's added back. (The bottom tabs hide while the keyboard
// is open, so these screens reach the bottom of the screen then.)
export function KeyboardAware({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const keyboard = useKeyboardHeight();
  const insets = useSafeAreaInsets();
  if (Platform.OS === "ios") {
    return (
      <KeyboardAvoidingView behavior="padding" style={style}>
        {children}
      </KeyboardAvoidingView>
    );
  }
  return <View style={[style, { paddingBottom: keyboard ? keyboard + insets.bottom : 0 }]}>{children}</View>;
}
