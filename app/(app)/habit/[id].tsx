import { Text, View } from "@/components/Themed";
import { deleteHabit, getHabitById } from "@/lib/habits";
import { hrefHabitEdit, hrefHabitListForType } from "@/lib/href";
import { habitStreakLabel } from "@/lib/habitStreakLabel";
import { productTheme } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { HeaderButton } from "@react-navigation/elements";
import { useTheme } from "@react-navigation/native";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet } from "react-native";
import type { Habit } from "@/types/habit";

function formatStart(s: string) {
  try {
    return new Date(s + "T12:00:00").toLocaleDateString();
  } catch {
    return s;
  }
}

export default function HabitDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { session } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [habit, setHabit] = useState<Habit | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /** When this matches `id`, we can refocus without full-screen loading (e.g. back from edit). */
  const lastSuccessIdRef = useRef<string | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true;
      if (!session?.user?.id || !id) {
        setLoading(false);
        return;
      }
      if (!silent) {
        setErr(null);
        setLoading(true);
      }
      const { data, error: fetchError } = await getHabitById(session.user.id, id);
      if (!silent) {
        setLoading(false);
      }
      if (fetchError) {
        if (!silent) {
          setErr(fetchError.message);
          setHabit(null);
        }
        if (!silent) {
          lastSuccessIdRef.current = null;
        }
        return;
      }
      if (!data) {
        setHabit(null);
        lastSuccessIdRef.current = null;
        if (!silent) {
          setErr(null);
        }
        return;
      }
      setHabit(data);
      setErr(null);
      lastSuccessIdRef.current = data.id;
    },
    [session?.user?.id, id]
  );

  useFocusEffect(
    useCallback(() => {
      if (!session?.user?.id || !id) return;
      const silent = lastSuccessIdRef.current === id;
      void load({ silent });
    }, [load, id, session?.user?.id])
  );

  const theme = habit ? productTheme[habit.type] : productTheme.build;

  const requestDelete = useCallback(() => {
    if (!habit || !session?.user?.id || deleting) return;
    const userId = session.user.id;
    const habitId = habit.id;
    const type = habit.type;
    Alert.alert(
      "Delete this habit?",
      "This can’t be undone. Logs and plans for this habit will be removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setDeleting(true);
              const { error: delErr } = await deleteHabit(userId, habitId);
              setDeleting(false);
              if (delErr) {
                Alert.alert("Could not delete", delErr.message);
                return;
              }
              if (navigation.canGoBack()) {
                navigation.goBack();
                return;
              }
              router.replace(hrefHabitListForType(type));
            })();
          },
        },
      ]
    );
  }, [habit, session?.user?.id, deleting, navigation, router]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions} lightColor="transparent" darkColor="transparent">
          <HeaderButton
            onPress={() => {
              if (!id) return;
              router.push(hrefHabitEdit(id));
            }}
            accessibilityLabel="Edit habit"
            pressOpacity={0.5}
          >
            <FontAwesome name="pencil" size={20} color={colors.text} />
          </HeaderButton>
          <HeaderButton
            onPress={requestDelete}
            accessibilityLabel="Delete habit"
            pressOpacity={0.5}
            disabled={!habit || deleting}
          >
            <FontAwesome name="trash-o" size={20} color={colors.text} />
          </HeaderButton>
        </View>
      ),
    });
  }, [colors.text, deleting, habit, id, navigation, requestDelete, router]);

  if (!id) {
    return (
      <View style={styles.centered}>
        <Text>Invalid link</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (err) {
    return (
      <View style={styles.padded}>
        <Text style={styles.error}>{err}</Text>
        <Pressable onPress={() => void load({ silent: false })}>
          <Text style={styles.link}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (!habit) {
    return (
      <View style={styles.padded}>
        <Text style={styles.muted} lightColor="#52525b" darkColor="#a1a1aa">
          Habit not found.
        </Text>
        <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <Text style={styles.link}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[styles.pill, { backgroundColor: theme.soft, borderColor: theme.border }]}
          lightColor="transparent"
          darkColor="transparent"
        >
          <Text style={styles.pillText} lightColor={theme.primary} darkColor={theme.primary}>
            {habit.type === "build" ? "Build" : "Break"}
          </Text>
        </View>

        <Text style={styles.title}>{habit.name}</Text>
        <Text style={styles.row} lightColor="#3f3f46" darkColor="#a1a1aa">
          Started: {formatStart(habit.start_date)}
        </Text>
        <Text style={styles.row} lightColor="#3f3f46" darkColor="#a1a1aa">
          Streak: {habitStreakLabel(habit)}
        </Text>
        <Text style={styles.row} lightColor="#3f3f46" darkColor="#a1a1aa">
          Plan: {habit.current_plan_id ? "Active plan linked" : "Not generated yet (Phase 6)"}
        </Text>

        {habit.context ? (
          <View style={styles.contextBox} lightColor="#f4f4f5" darkColor="rgba(255,255,255,0.06)">
            <Text style={styles.contextLabel}>Context</Text>
            <Text style={styles.contextBody}>{habit.context}</Text>
          </View>
        ) : null}

        <View style={styles.hint} lightColor="#e4e4e7" darkColor="#3f3f46">
          <Text style={styles.hintText} lightColor="#52525b" darkColor="#a1a1aa">
            Generate and edit plans in upcoming phases. This screen is the habit detail shell.
          </Text>
        </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 20, paddingBottom: 40, maxWidth: 480, width: "100%", alignSelf: "center" },
  pill: { alignSelf: "flex-start", marginBottom: 12, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 13, fontWeight: "600" },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
  row: { fontSize: 16, lineHeight: 24, marginBottom: 4 },
  contextBox: { marginTop: 20, borderRadius: 10, padding: 14 },
  contextLabel: { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, opacity: 0.8 },
  contextBody: { fontSize: 16, lineHeight: 24 },
  hint: { marginTop: 24, borderRadius: 8, padding: 12 },
  hintText: { fontSize: 14, lineHeight: 20 },
  padded: { flex: 1, padding: 20 },
  error: { color: "#b91c1c", marginBottom: 12 },
  link: { color: "#2f95dc", fontSize: 16, fontWeight: "500" },
  muted: { fontSize: 16, marginBottom: 12 },
  headerActions: { flexDirection: "row", alignItems: "center" },
});
