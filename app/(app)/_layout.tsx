import { useAuth } from "@/contexts/AuthContext";
import { href } from "@/lib/href";
import { useRouter, Stack, Redirect } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";

function ModalHeaderDone() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  return (
    <Pressable
      onPress={() => router.back()}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingHorizontal: 12, paddingVertical: 8 })}
      accessibilityLabel="Close"
    >
      <Text style={{ color: Colors[colorScheme].tint, fontSize: 17, fontWeight: "600" }}>Done</Text>
    </Pressable>
  );
}

export default function AppGroupLayout() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href={href.authLogin} />;
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="modal"
        options={{
          presentation: "modal",
          title: "About Habit Agent",
          headerRight: () => <ModalHeaderDone />,
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
});
