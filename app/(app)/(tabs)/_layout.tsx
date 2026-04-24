import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Link, Tabs, useRouter } from "expo-router";
import React from "react";
import { Platform, Pressable } from "react-native";

import { useClientOnlyValue } from "@/components/useClientOnlyValue";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { productTheme } from "@/constants/theme";
import { hrefHabitNew } from "@/lib/href";

const tabAccent = {
  today: productTheme.today.primary,
  build: productTheme.build.primary,
  break: productTheme.break.primary,
  track: productTheme.track.primary,
  profile: productTheme.profile.primary,
} as const;

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>["name"];
  color: string;
}) {
  return <FontAwesome size={24} style={{ marginBottom: -2 }} {...props} />;
}

function AddHabitHeaderButton({ kind }: { kind: "build" | "break" }) {
  const router = useRouter();
  const color = kind === "build" ? tabAccent.build : tabAccent.break;
  return (
    <Pressable
      onPress={() => router.push(hrefHabitNew(kind))}
      accessibilityLabel={kind === "build" ? "Add build habit" : "Add break habit"}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginRight: 16 })}
    >
      <FontAwesome name="plus" size={22} color={color} />
    </Pressable>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? "light";
  const theme = Colors[colorScheme];
  const inactive = theme.tabIconDefault;

  return (
    <Tabs
      screenOptions={{
        tabBarInactiveTintColor: inactive,
        headerShown: useClientOnlyValue(false, true),
        // Native stack default on Android is start-aligned; center matches iOS and typical tab shells.
        ...(Platform.OS === "android" && { headerTitleAlign: "center" as const }),
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: "Today",
          headerTintColor: tabAccent.today,
          headerTitleStyle: { color: tabAccent.today },
          tabBarActiveTintColor: tabAccent.today,
          tabBarIcon: ({ focused }) => (
            <TabBarIcon
              name="calendar"
              color={focused ? tabAccent.today : inactive}
            />
          ),
          headerRight: () => (
            <Link href="/modal" asChild>
              <Pressable accessibilityLabel="App info">
                {({ pressed }) => (
                  <FontAwesome
                    name="info-circle"
                    size={24}
                    color={tabAccent.today}
                    style={{ marginRight: 16, opacity: pressed ? 0.5 : 1 }}
                  />
                )}
              </Pressable>
            </Link>
          ),
        }}
      />
      <Tabs.Screen
        name="build"
        options={{
          title: "Build",
          headerTintColor: tabAccent.build,
          headerTitleStyle: { color: tabAccent.build },
          tabBarActiveTintColor: tabAccent.build,
          headerRight: () => <AddHabitHeaderButton kind="build" />,
          tabBarIcon: ({ focused }) => (
            <TabBarIcon
              name="plus-circle"
              color={focused ? tabAccent.build : inactive}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="break"
        options={{
          title: "Break",
          headerTintColor: tabAccent.break,
          headerTitleStyle: { color: tabAccent.break },
          tabBarActiveTintColor: tabAccent.break,
          headerRight: () => <AddHabitHeaderButton kind="break" />,
          tabBarIcon: ({ focused }) => (
            <TabBarIcon
              name="chain-broken"
              color={focused ? tabAccent.break : inactive}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="track"
        options={{
          title: "Track",
          headerTintColor: tabAccent.track,
          headerTitleStyle: { color: tabAccent.track },
          tabBarActiveTintColor: tabAccent.track,
          tabBarIcon: ({ focused }) => (
            <TabBarIcon
              name="bar-chart"
              color={focused ? tabAccent.track : inactive}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          // Match page titles: use theme text (white in dark mode), not the gray profile accent
          headerTintColor: theme.text,
          headerTitleStyle: { color: theme.text },
          tabBarActiveTintColor: tabAccent.profile,
          tabBarIcon: ({ focused }) => (
            <TabBarIcon
              name="user"
              color={focused ? tabAccent.profile : inactive}
            />
          ),
        }}
      />
    </Tabs>
  );
}
