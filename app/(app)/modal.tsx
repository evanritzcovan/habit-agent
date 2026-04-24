import { Text, View } from "@/components/Themed";
import Constants from "expo-constants";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "@/components/useColorScheme";
import { ScrollView, StyleSheet } from "react-native";

const version = Constants.expoConfig?.version ?? "0.0.0";

export default function AboutModalScreen() {
  const scheme = useColorScheme() ?? "light";

  return (
    <View style={styles.wrap}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.lead}>
          Habit Agent helps you build and break habits with short AI-made plans, daily check-ins, and
          streaks that respect what is actually due each day.
        </Text>
        <View style={styles.block}>
          <Text style={styles.heading} accessibilityRole="header">
            This preview
          </Text>
          <Text style={styles.p}>
            You are on the app shell: tabs, theming, and sign-in. Habit data, plan generation, and
            Today will show up in later releases as those phases land.
          </Text>
        </View>
        <View style={styles.block}>
          <Text style={styles.heading}>Version</Text>
          <Text style={styles.versionText}>{String(version)}</Text>
        </View>
        <Text style={styles.footnote} lightColor="#71717a" darkColor="#a1a1aa">
          Use the back control in the header to return to the Today tab.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  content: { padding: 20, paddingBottom: 32, maxWidth: 420, width: "100%", alignSelf: "center" },
  lead: { fontSize: 17, lineHeight: 25, marginBottom: 20 },
  block: { marginBottom: 20 },
  heading: { fontSize: 16, fontWeight: "600", marginBottom: 6 },
  p: { fontSize: 15, lineHeight: 22, opacity: 0.9 },
  versionText: { fontSize: 15, fontFamily: "SpaceMono" },
  footnote: { fontSize: 13, lineHeight: 18, marginTop: 8 },
});
