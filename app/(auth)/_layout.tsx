import { useAuth } from "@/contexts/AuthContext";
import { href } from "@/lib/href";
import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

export default function AuthGroupLayout() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (session) {
    return <Redirect href={href.appHome} />;
  }

  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="login" options={{ title: "Log in" }} />
      <Stack.Screen name="signup" options={{ title: "Create account" }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
});
