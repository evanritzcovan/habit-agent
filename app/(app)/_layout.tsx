import { useAuth } from "@/contexts/AuthContext";
import { href } from "@/lib/href";
import { useTheme } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { Redirect, withLayoutContext } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

// Intentionally JS stack: native stack caused an iOS headerRight layout/hitbox bug here.
const JSStack = withLayoutContext(createStackNavigator().Navigator);

export default function AppGroupLayout() {
  const { session, isLoading } = useAuth();
  const { colors } = useTheme();

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
    <JSStack>
      <JSStack.Screen
        name="(tabs)"
        options={{
          headerShown: false,
          title: "Habits",
          headerBackTitle: "Habits",
        }}
      />
      <JSStack.Screen
        name="habit/new"
        options={{
          title: "New habit",
          headerShown: true,
          headerTintColor: colors.text,
          headerLeftContainerStyle: styles.backButtonInset,
          headerBackTitleVisible: false,
          headerBackTitle: "",
        }}
      />
      <JSStack.Screen
        name="habit/[id]"
        options={{
          title: "Details",
          headerShown: true,
          headerTintColor: colors.text,
          headerLeftContainerStyle: styles.backButtonInset,
          headerRightContainerStyle: styles.editButtonInset,
          headerBackTitleVisible: false,
          headerBackTitle: "",
        }}
      />
      <JSStack.Screen
        name="habit/edit/[id]"
        options={{
          title: "Edit",
          headerShown: true,
          headerTintColor: colors.text,
          headerLeftContainerStyle: styles.backButtonInset,
          headerBackTitleVisible: false,
          headerBackTitle: "",
        }}
      />
      <JSStack.Screen
        name="modal"
        options={{
          presentation: "modal",
          title: "About Habit Agent",
          headerTintColor: colors.text,
          headerLeftContainerStyle: styles.backButtonInset,
          headerBackTitleVisible: false,
          headerBackTitle: "",
        }}
      />
    </JSStack>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  backButtonInset: { paddingLeft: 8 },
  editButtonInset: { paddingRight: 8 },
});
