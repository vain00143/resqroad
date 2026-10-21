import { forwardRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputInstance,
  type TextInputProps,
  type TextStyle,
} from "react-native";

import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";
import { fonts, radius, useTheme } from "@/theme";

type Props = TextInputProps & {
  label: string;
  icon?: IconName;
  hint?: string;
  // Adds a show/hide button for passwords.
  password?: boolean;
};

// Browsers draw their own focus ring; the box border shows focus instead.
const noWebOutline = Platform.OS === "web" ? ({ outlineStyle: "none" } as unknown as TextStyle) : null;

export const TextField = forwardRef<TextInputInstance, Props>(function TextField(
  { label, icon, hint, password, style, onFocus, onBlur, ...props },
  ref,
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  return (
    <View style={styles.field}>
      <AppText variant="label" tone="heading">
        {label}
      </AppText>
      <View
        style={[
          styles.box,
          props.multiline && styles.multilineBox,
          { backgroundColor: colors.surface, borderColor: focused ? colors.focus : colors.borderStrong },
        ]}
      >
        {icon ? <Icon name={icon} size={18} /> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.placeholder}
          selectionColor={colors.accent}
          secureTextEntry={password && hidden}
          textAlignVertical={props.multiline ? "top" : undefined}
          style={[styles.input, props.multiline && styles.multilineInput, noWebOutline, { color: colors.text }, style]}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...props}
        />
        {password ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
            hitSlop={10}
            onPress={() => setHidden((value) => !value)}
          >
            <Icon name={hidden ? "eye" : "eye-off"} size={18} />
          </Pressable>
        ) : null}
      </View>
      {hint ? <AppText variant="caption">{hint}</AppText> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: { gap: 6 },
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  input: {
    flex: 1,
    minHeight: 46,
    paddingVertical: 0,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  multilineBox: { alignItems: "flex-start", paddingVertical: 12 },
  multilineInput: { minHeight: 96, lineHeight: 21 },
});
