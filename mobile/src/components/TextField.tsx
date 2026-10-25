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

import { AppText, maxFontScale } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";
import { fonts, radius, useTheme } from "@/theme";

type Props = TextInputProps & {
  label: string;
  icon?: IconName;
  hint?: string;
  // Shown under the box in red, in place of the hint.
  error?: string | null;
  // Adds a show/hide button for passwords.
  password?: boolean;
};

// Browsers draw their own focus ring; the box border shows focus instead.
const noWebOutline = Platform.OS === "web" ? ({ outlineStyle: "none" } as unknown as TextStyle) : null;

export const TextField = forwardRef<TextInputInstance, Props>(function TextField(
  { label, icon, hint, error, password, style, onFocus, onBlur, ...props },
  ref,
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const borderColor = error ? colors.danger : focused ? colors.focus : colors.borderStrong;

  return (
    <View style={styles.field}>
      <AppText variant="label" tone="heading">
        {label}
      </AppText>
      <View style={[styles.box, props.multiline && styles.multilineBox, { backgroundColor: colors.surface, borderColor }]}>
        {icon ? <Icon name={icon} size={16} /> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.placeholder}
          selectionColor={colors.accent}
          secureTextEntry={password && hidden}
          textAlignVertical={props.multiline ? "top" : undefined}
          maxFontSizeMultiplier={maxFontScale}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
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
            <Icon name={hidden ? "eye" : "eye-off"} size={16} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <View style={styles.error} accessibilityRole="alert">
          <Icon name="alert-circle" size={13} color={colors.danger} />
          <AppText variant="caption" tone="danger" style={styles.errorText}>
            {error}
          </AppText>
        </View>
      ) : hint ? (
        <AppText variant="caption">{hint}</AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: { gap: 5 },
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  input: {
    flex: 1,
    minHeight: 40,
    paddingVertical: 0,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  multilineBox: { alignItems: "flex-start", paddingVertical: 10 },
  multilineInput: { minHeight: 84, lineHeight: 20 },
  error: { flexDirection: "row", alignItems: "center", gap: 5 },
  errorText: { flex: 1 },
});
