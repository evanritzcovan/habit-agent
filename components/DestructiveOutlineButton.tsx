import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loadingLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** Outlined “danger” control so destructive actions read as tappable, not as bare text. */
export function DestructiveOutlineButton({
  label,
  onPress,
  disabled = false,
  loadingLabel,
  style,
}: Props) {
  const scheme = useColorScheme() ?? "light";
  const loading = Boolean(loadingLabel);
  const busy = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [
        styles.btn,
        scheme === "dark" ? styles.btnDark : styles.btnLight,
        { opacity: pressed && !busy ? 0.88 : busy ? 0.65 : 1 },
        style,
      ]}
    >
      <Text style={styles.text} lightColor="#b91c1c" darkColor="#f87171">
        {loading ? loadingLabel : label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: 10,
    borderWidth: 1.5,
    alignSelf: "stretch",
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  btnLight: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
  },
  btnDark: {
    backgroundColor: "rgba(127, 29, 29, 0.28)",
    borderColor: "rgba(248, 113, 113, 0.45)",
  },
  text: { fontSize: 16, fontWeight: "600" },
});
