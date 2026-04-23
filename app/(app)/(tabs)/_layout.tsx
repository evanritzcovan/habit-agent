import React from "react";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Link, Tabs } from "expo-router";
import { Pressable, View } from "react-native";

import Colors from "@/constants/Colors";
import { productTheme } from "@/constants/theme";
import { useColorScheme } from "@/components/useColorScheme";
import { useClientOnlyValue } from "@/components/useClientOnlyValue";

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

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? "light";
  const theme = Colors[colorScheme];
  const inactive = theme.tabIconDefault;

  return (
    <Tabs
      screenOptions={{
        tabBarInactiveTintColor: inactive,
        headerShown: useClientOnlyValue(false, true),
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: "Today",
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
          tabBarActiveTintColor: tabAccent.build,
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
          tabBarActiveTintColor: tabAccent.break,
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
