import { forwardRef } from "react";
import { Platform, TextInput, type TextInputProps } from "react-native";

/**
 * On Android, a controlled `TextInput` with `secureTextEntry` re-applies the `value` prop from JS
 * on every keystroke, which fights the native password mask and can show each character briefly
 * (see e.g. facebook/react-native#53696). Omitting `value` keeps the field native-uncontrolled; keep
 * form state in sync only via `onChangeText` / `onChange`. iOS still uses a controlled `value`.
 */
export const PasswordTextInput = forwardRef<TextInput, TextInputProps>(function PasswordTextInput(
  { value, defaultValue, secureTextEntry = true, ...rest },
  ref
) {
  if (Platform.OS === "android") {
    return (
      <TextInput
        ref={ref}
        {...rest}
        defaultValue={defaultValue ?? ""}
        secureTextEntry={secureTextEntry}
      />
    );
  }
  return (
    <TextInput
      ref={ref}
      {...rest}
      value={value}
      defaultValue={defaultValue}
      secureTextEntry={secureTextEntry}
    />
  );
});
