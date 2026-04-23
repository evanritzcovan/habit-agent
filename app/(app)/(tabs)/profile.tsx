import { Text, View } from "@/components/Themed";
import { useAuth } from "@/contexts/AuthContext";
import { ShellTopAccent } from "@/components/shell/TabEmptyState";
import { useThemePreference, type ThemePreference } from "@/contexts/ThemePreferenceContext";
import { productTheme } from "@/constants/theme";
import { Pressable, ScrollView, StyleSheet, View as RNView } from "react-native";

const p = productTheme.profile;

const appearanceOptions: { value: ThemePreference; label: string; hint: string }[] = [
  { value: "system", label: "System default", hint: "Match light or dark to your device" },
  { value: "light", label: "Light", hint: "Always use light mode" },
  { value: "dark", label: "Dark", hint: "Always use dark mode" },
];

function AppearanceOption({
  value,
  label,
  hint,
  selected,
  onSelect,
}: {
  value: ThemePreference;
  label: string;
  hint: string;
  selected: boolean;
  onSelect: (v: ThemePreference) => void;
}) {
  return (
    <Pressable
      onPress={() => onSelect(value)}
      style={({ pressed }) => [styles.appearanceRow, { opacity: pressed ? 0.75 : 1 }]}
    >
      <RNView style={styles.appearanceTextBox}>
        <Text style={styles.appearanceLabel}>{label}</Text>
        <Text
          style={styles.appearanceHint}
          lightColor="#52525b"
          darkColor="#a1a1aa"
        >
          {hint}
        </Text>
      </RNView>
      {selected && (
        <Text style={styles.check} lightColor={p.primary} darkColor={p.primary}>
          ✓
        </Text>
      )}
    </Pressable>
  );
}

/** Profile: account, theme, subscription (Phase 14). */
export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const { preference, setPreference } = useThemePreference();
  const email = session?.user?.email ?? "Signed in";

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <ShellTopAccent variant="profile" />
      <View style={styles.inner} lightColor="transparent" darkColor="transparent">
        <Text style={styles.title} lightColor={p.primary} darkColor={p.primary}>
          Profile
        </Text>
        <Text style={styles.email} numberOfLines={2}>
          {email}
        </Text>

        <Text style={styles.sectionTitle} accessibilityRole="header">
          Appearance
        </Text>
        <View
          style={[styles.appearanceCard, { borderColor: p.border }]}
          lightColor="#f9fafb"
          darkColor="rgba(255,255,255,0.06)"
        >
          {appearanceOptions.map((opt, i) => (
            <RNView
              key={opt.value}
              style={
                i < appearanceOptions.length - 1
                  ? [styles.appearanceDivider, { borderBottomColor: p.border }]
                  : undefined
              }
            >
              <AppearanceOption
                {...opt}
                selected={preference === opt.value}
                onSelect={setPreference}
              />
            </RNView>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Subscription</Text>
        <View
          style={[styles.card, { borderColor: p.border }]}
          lightColor="#f4f4f5"
          darkColor="rgba(255,255,255,0.06)"
        >
          <Text
            style={styles.cardBody}
            lightColor="#52525b"
            darkColor="#a1a1aa"
          >
            Free tier and paywall will show here (RevenueCat in a later phase).
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: productTheme.today.primary, opacity: pressed ? 0.85 : 1 },
            ]}
            disabled
          >
            <Text style={styles.ctaText} lightColor="#fff" darkColor="#0f172a">
              View plans (soon)
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => {
            void signOut();
          }}
          style={({ pressed }) => [styles.signOut, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={styles.signOutText} lightColor="#b91c1c" darkColor="#f87171">
            Sign out
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  inner: {
    paddingHorizontal: 24,
    paddingTop: 20,
    maxWidth: 400,
    alignSelf: "center",
    width: "100%",
  },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 6 },
  email: { fontSize: 15, opacity: 0.85, marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8, opacity: 0.85 },
  appearanceCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 24,
  },
  appearanceDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  appearanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  appearanceTextBox: { flex: 1, marginRight: 8 },
  appearanceLabel: { fontSize: 16, fontWeight: "500" },
  appearanceHint: { fontSize: 12, marginTop: 2 },
  check: { fontSize: 18, fontWeight: "700" },
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 20,
  },
  cardBody: { fontSize: 15, lineHeight: 22, marginBottom: 14 },
  cta: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  ctaText: { fontSize: 16, fontWeight: "600" },
  signOut: {
    alignSelf: "flex-start",
    paddingVertical: 8,
  },
  signOutText: { fontSize: 16, fontWeight: "600" },
});
