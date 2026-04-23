import { Text, View } from "@/components/Themed";
import { type TabShellVariant, getTabAccent } from "@/constants/theme";
import { type ReactNode } from "react";
import { StyleSheet, View as RNView } from "react-native";

export function ShellTopAccent({ variant }: { variant: TabShellVariant }) {
  const accent = getTabAccent(variant);
  if (!accent) return null;
  return (
    <RNView
      style={[
        styles.topAccent,
        { backgroundColor: accent.soft, borderColor: accent.border },
      ]}
    />
  );
}

type Props = {
  title: string;
  children: ReactNode;
  variant?: TabShellVariant;
};

/**
 * Centered empty / placeholder with optional pastel top strip per tab.
 */
export function TabEmptyState({ title, children, variant = "default" }: Props) {
  const accent = getTabAccent(variant);

  return (
    <View style={styles.outer}>
      {accent && <ShellTopAccent variant={variant} />}
      <View style={styles.inner}>
        <Text
          style={styles.title}
          lightColor={accent?.primary}
          darkColor={accent?.primary}
        >
          {title}
        </Text>
        <Text
          style={styles.body}
          lightColor={accent ? "#3f3f46" : "#52525b"}
          darkColor={accent ? "#a1a1aa" : "#a1a1aa"}
        >
          {children}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1 },
  topAccent: {
    height: 4,
    width: "100%",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    maxWidth: 400,
    alignSelf: "center",
    width: "100%",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 10,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
});
