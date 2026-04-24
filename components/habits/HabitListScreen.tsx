import { Text, View } from "@/components/Themed";
import { ShellTopAccent } from "@/components/shell/TabEmptyState";
import { useColorScheme } from "@/components/useColorScheme";
import { productTheme } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { habitStreakLabel } from "@/lib/habitStreakLabel";
import { listHabitsForUser } from "@/lib/habits";
import { hrefHabitDetail } from "@/lib/href";
import type { Habit, HabitType } from "@/types/habit";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet } from "react-native";

const copy: Record<
  HabitType,
  { subtitle: string; blurb: string; emptyTitle: string; emptyBody: string; variant: "build" | "break" }
> = {
  build: {
    subtitle: "Grow habits with plans and streaks",
    blurb: "Everything you are adding, with check-ins and streaks as you go.",
    emptyTitle: "No build habits yet",
    emptyBody: "Add your first habit to start a plan in the next phase.",
    variant: "build",
  },
  break: {
    subtitle: "Leave habits you want behind",
    blurb: "Track what you are quitting with the same tools, break-focused and clear.",
    emptyTitle: "No break habits yet",
    emptyBody: "Add a habit to track the behavior you are leaving behind.",
    variant: "break",
  },
};

function formatStart(s: string) {
  try {
    return new Date(s + "T12:00:00").toLocaleDateString();
  } catch {
    return s;
  }
}

const byHabitId = (x: Habit, y: Habit) => x.id.localeCompare(y.id);

/** Avoid re-rendering when a silent refetch returns the same data (order may differ from API). */
function habitRowsEqual(a: Habit[], b: Habit[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort(byHabitId);
  const sb = [...b].sort(byHabitId);
  for (let i = 0; i < sa.length; i++) {
    const x = sa[i];
    const y = sb[i];
    if (
      x.id !== y.id ||
      x.name !== y.name ||
      x.type !== y.type ||
      x.start_date !== y.start_date ||
      x.current_plan_id !== y.current_plan_id ||
      x.context !== y.context ||
      x.created_at !== y.created_at
    ) {
      return false;
    }
  }
  return true;
}

export function HabitListScreen({ kind }: { kind: HabitType }) {
  const c = copy[kind];
  const theme = productTheme[kind];
  const { session } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const [rows, setRows] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef(false);
  const lastUserIdRef = useRef<string | undefined>(undefined);
  const rowsRef = useRef<Habit[]>([]);

  const userId = session?.user?.id;

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    if (lastUserIdRef.current === userId) return;
    lastUserIdRef.current = userId;
    hasLoadedOnceRef.current = false;
    setRows([]);
    setError(null);
    if (userId) setLoading(true);
    else setLoading(false);
  }, [userId]);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!userId) return;
      const silent = opts?.silent === true;
      if (!silent) {
        setError(null);
        setLoading(true);
      }
      const { data, error: fetchError } = await listHabitsForUser(userId, kind);
      if (!silent) setLoading(false);
      hasLoadedOnceRef.current = true;
      if (fetchError) {
        if (!silent) {
          setError(fetchError.message);
          setRows([]);
        }
        return;
      }
      const next = data ?? [];
      if (silent) {
        if (habitRowsEqual(rowsRef.current, next)) {
          return;
        }
        setRows(next);
        return;
      }
      setRows(next);
      setError(null);
    },
    [userId, kind]
  );

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      void load({ silent: hasLoadedOnceRef.current });
    }, [load, userId])
  );

  if (!session) {
    return null;
  }

  return (
    <View style={styles.screen}>
      <ShellTopAccent variant={c.variant} />
      <View
        style={styles.contentFrame}
        lightColor="transparent"
        darkColor="transparent"
      >
        <View style={styles.headerBlock}>
          <Text
            style={styles.subtitle}
            lightColor={theme.primary}
            darkColor={theme.primary}
          >
            {c.subtitle}
          </Text>
          <Text style={styles.sub} lightColor="#52525b" darkColor="#a1a1aa">
            {c.blurb}
          </Text>
        </View>

        {error ? (
          <Text style={styles.err}>{error}</Text>
        ) : loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" />
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>{c.emptyTitle}</Text>
            <Text
              style={styles.emptyBody}
              lightColor="#52525b"
              darkColor="#a1a1aa"
            >
              {c.emptyBody}
            </Text>
          </View>
        ) : (
          <FlatList
            style={styles.listFlex}
            data={rows}
            keyExtractor={(h) => h.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.navigate(hrefHabitDetail(item.id))}
                style={({ pressed }) => [
                  styles.card,
                  {
                    borderColor:
                      colorScheme === "dark" ? "rgba(255, 255, 255, 0.26)" : "rgba(0, 0, 0, 0.14)",
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={styles.meta} lightColor="#52525b" darkColor="#a1a1aa">
                  Started {formatStart(item.start_date)} · Streak {habitStreakLabel(item)}
                </Text>
              </Pressable>
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // Matches TabEmptyState / Profile: centered column so subtitle & body line up with other tab shells
  contentFrame: {
    flex: 1,
    maxWidth: 400,
    width: "100%",
    alignSelf: "center",
    minWidth: 0,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  headerBlock: { marginBottom: 8 },
  subtitle: { fontSize: 15, fontWeight: "600", lineHeight: 20 },
  sub: { fontSize: 15, lineHeight: 22, marginTop: 4 },
  listFlex: { flex: 1 },
  listContent: { paddingBottom: 32, gap: 10, flexGrow: 1 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  cardTitle: { fontSize: 17, fontWeight: "600" },
  meta: { fontSize: 14, marginTop: 6 },
  centered: { flex: 1, justifyContent: "center" },
  err: { color: "#b91c1c", marginTop: 12 },
  emptyBox: { paddingTop: 24, alignItems: "center" },
  emptyTitle: { fontSize: 17, fontWeight: "600", marginBottom: 8, textAlign: "center" },
  emptyBody: { fontSize: 15, lineHeight: 22, textAlign: "center", maxWidth: 320 },
});
