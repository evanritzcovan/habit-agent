import { Text, View } from "@/components/Themed";
import {
  type TabShellVariant,
  getTabAccent,
  productThemeHeaderStrip,
} from "@/constants/theme";
import { type ReactNode } from "react";
import { StyleSheet, View as RNView } from "react-native";

export function ShellTopAccent({ variant }: { variant: TabShellVariant }) {
  const accent = getTabAccent(variant);
  if (!accent) return null;
  const strip = productThemeHeaderStrip[variant as keyof typeof productThemeHeaderStrip];
  return (
    <RNView
      style={[
        styles.topAccent,
        { backgroundColor: strip.soft, borderColor: strip.border },
      ]}
    />
  );
}

type Props = {
  /** Short line under the tab header; not a repeat of the nav title. */
  subtitle: string;
  children: ReactNode;
  variant?: TabShellVariant;
};

/**
 * Centered empty / placeholder with optional pastel top strip per tab.
 */
export function TabEmptyState({ subtitle, children, variant = "default" }: Props) {
  const accent = getTabAccent(variant);

  return (
    <View style={styles.outer}>
      {accent && <ShellTopAccent variant={variant} />}
      <View style={styles.inner}>
        <Text
          style={styles.subtitle}
          lightColor={accent?.primary}
          darkColor={accent?.primary}
        >
          {subtitle}
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
  subtitle: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
    marginBottom: 8,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
});
