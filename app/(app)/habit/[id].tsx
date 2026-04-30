import {
  HabitTabBar,
  HistoryTabPanel,
  PlanTabPanel,
  ProgressTabPanel,
  type DetailTab,
} from "@/components/habits/HabitDetailPanels";
import { Text, View } from "@/components/Themed";
import { productTheme } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { getAiGenerationUiState, type AiGenerationUiState } from "@/lib/aiGeneration";
import { isPrePlanStepId } from "@/lib/aiPlanSetup";
import {
  getHabitDetailCache,
  habitDetailCacheEntryFromState,
  invalidateHabitDetailCache,
  setHabitDetailCache,
} from "@/lib/habitDetailCache";
import {
  fetchHabitLogProgressStats,
  fetchStepCompletionForDate,
  todayLogDateString,
  upsertStepLog,
  type HabitLogProgressStats,
} from "@/lib/habitLogs";
import { fetchPlanVersionsForHabit } from "@/lib/habitPlans";
import { deleteHabit, getHabitById } from "@/lib/habits";
import { habitStreakLabel } from "@/lib/habitStreakLabel";
import { hrefHabitEdit, hrefHabitListForType } from "@/lib/href";
import { generateAndAttachPlan } from "@/lib/planGeneration";
import type { AiPlanJson } from "@/schemas/aiPlan.zod";
import { aiPlanSchemaForHabitType } from "@/schemas/aiPlan.zod";
import type { Habit } from "@/types/habit";
import type { HabitPlanRow } from "@/types/habitPlan";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { HeaderButton } from "@react-navigation/elements";
import { useTheme } from "@react-navigation/native";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet } from "react-native";

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
  const userId = session?.user?.id;
  const [habit, setHabit] = useState<Habit | null>(() =>
    userId && id ? getHabitDetailCache(userId, id)?.habit ?? null : null
  );
  const [loading, setLoading] = useState(() => !(userId && id && getHabitDetailCache(userId, id)));
  const [deleting, setDeleting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genUi, setGenUi] = useState<AiGenerationUiState | null>(() =>
    userId && id ? getHabitDetailCache(userId, id)?.genUi ?? null : null
  );
  const [err, setErr] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("plan");
  const [planVersions, setPlanVersions] = useState<HabitPlanRow[]>(() =>
    userId && id ? getHabitDetailCache(userId, id)?.planVersions ?? [] : []
  );
  const [logStats, setLogStats] = useState<HabitLogProgressStats | null>(() =>
    userId && id ? getHabitDetailCache(userId, id)?.logStats ?? null : null
  );
  const [stepDoneToday, setStepDoneToday] = useState<Map<string, boolean>>(() => {
    const c = userId && id ? getHabitDetailCache(userId, id) : undefined;
    return new Map(Object.entries(c?.stepDoneToday ?? {}));
  });
  const stepDoneTodayRef = useRef(stepDoneToday);
  stepDoneTodayRef.current = stepDoneToday;
  const [regenerateNote, setRegenerateNote] = useState("");
  const lastSuccessIdRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!session?.user?.id || !id) return;
    const uid = session.user.id;
    const cached = getHabitDetailCache(uid, id);
    if (cached) {
      setHabit(cached.habit);
      setPlanVersions(cached.planVersions);
      setGenUi(cached.genUi);
      setLogStats(cached.logStats);
      setStepDoneToday(new Map(Object.entries(cached.stepDoneToday)));
      setErr(null);
      setLoading(false);
      lastSuccessIdRef.current = id;
      return;
    }
    setHabit((h) => (h?.id === id ? h : null));
    setPlanVersions([]);
    setGenUi(null);
    setLogStats(null);
    setStepDoneToday(new Map());
    lastSuccessIdRef.current = null;
    setLoading(true);
  }, [session?.user?.id, id]);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true;
      if (!session?.user?.id || !id) {
        setLoading(false);
        setGenUi(null);
        setPlanVersions([]);
        setLogStats(null);
        setStepDoneToday(new Map());
        return;
      }
      const cachedSnapshot = getHabitDetailCache(session.user.id, id);
      const blockSpinner = !silent && !cachedSnapshot;
      if (blockSpinner) {
        setErr(null);
        setLoading(true);
      }
      const { data, error: fetchError } = await getHabitById(session.user.id, id);
      if (fetchError) {
        if (!silent) {
          setLoading(false);
          setErr(fetchError.message);
          setHabit(null);
          setGenUi(null);
          setPlanVersions([]);
          setLogStats(null);
          lastSuccessIdRef.current = null;
        }
        return;
      }
      if (!data) {
        invalidateHabitDetailCache(session.user.id, id);
        setHabit(null);
        lastSuccessIdRef.current = null;
        setGenUi(null);
        setPlanVersions([]);
        setLogStats(null);
        setStepDoneToday(new Map());
        if (!silent) {
          setErr(null);
          setLoading(false);
        }
        return;
      }

      const userId = session.user.id;
      const today = todayLogDateString();
      try {
        const [pvRes, uiRes, statsRes, compRes] = await Promise.all([
          fetchPlanVersionsForHabit(userId, data.id),
          getAiGenerationUiState(userId),
          fetchHabitLogProgressStats(data.id),
          fetchStepCompletionForDate(data.id, today),
        ]);

        setHabit(data);
        setErr(null);
        lastSuccessIdRef.current = data.id;
        if (pvRes.data) {
          setPlanVersions(pvRes.data);
        } else {
          setPlanVersions([]);
        }
        setGenUi(uiRes.data);
        setLogStats(statsRes.data);
        setStepDoneToday(compRes.data ?? new Map());
        setHabitDetailCache(
          userId,
          data.id,
          habitDetailCacheEntryFromState(
            data,
            pvRes.data ?? [],
            uiRes.data ?? null,
            statsRes.data ?? null,
            compRes.data ?? new Map()
          )
        );
      } catch {
        if (!silent) {
          setLoading(false);
          setErr("Could not load habit details.");
        }
        return;
      }
      if (!silent) {
        setLoading(false);
      }
    },
    [session?.user?.id, id]
  );

  useFocusEffect(
    useCallback(() => {
      if (!session?.user?.id || !id) return;
      const hasCached = Boolean(getHabitDetailCache(session.user.id, id));
      const silent = lastSuccessIdRef.current === id || hasCached;
      void load({ silent });
    }, [load, id, session?.user?.id])
  );

  const theme = habit ? productTheme[habit.type] : productTheme.build;

  const activePlanRow = useMemo(
    () => planVersions.find((p) => p.is_active) ?? null,
    [planVersions]
  );

  const { parsedPlan, planParseError } = useMemo((): {
    parsedPlan: AiPlanJson | null;
    planParseError: string | null;
  } => {
    if (!habit || !activePlanRow) {
      return { parsedPlan: null, planParseError: null };
    }
    const r = aiPlanSchemaForHabitType(habit.type).safeParse(activePlanRow.ai_plan);
    if (r.success) {
      return { parsedPlan: r.data, planParseError: null };
    }
    return { parsedPlan: null, planParseError: r.error.message };
  }, [habit, activePlanRow]);

  /** Ignore log rows for step_ids not in the active plan (e.g. after regenerate). */
  const stepDoneTodayForActivePlan = useMemo(() => {
    if (!parsedPlan) {
      return stepDoneToday;
    }
    const allowed = new Set<string>();
    for (const p of parsedPlan.pre_plan_steps) {
      allowed.add(p.id);
    }
    for (const s of parsedPlan.steps) {
      allowed.add(s.id);
    }
    const next = new Map<string, boolean>();
    for (const [sid, done] of stepDoneToday) {
      if (allowed.has(sid)) {
        next.set(sid, done);
      }
    }
    return next;
  }, [parsedPlan, stepDoneToday]);

  const runGeneration = useCallback(
    async (payload: Parameters<typeof generateAndAttachPlan>[2]) => {
      if (!habit || !session?.user?.id) return;
      setGenerating(true);
      const result = await generateAndAttachPlan(session.user.id, habit.id, payload);
      setGenerating(false);
      if (result.error) {
        if (result.limitInfo) {
          Alert.alert("Generation limit", result.error.message);
        } else {
          Alert.alert("Could not generate plan", result.error.message);
        }
      } else {
        setRegenerateNote("");
        if (session.user?.id && habit) {
          invalidateHabitDetailCache(session.user.id, habit.id);
        }
      }
      if (session.user?.id) {
        const { data: ui } = await getAiGenerationUiState(session.user.id);
        setGenUi(ui);
      }
      await load({ silent: false });
    },
    [habit, load, session?.user?.id]
  );

  const runGeneratePlan = useCallback(() => {
    if (!habit || !session?.user?.id || generating || habit.current_plan_id) return;
    if (!genUi?.isPaid && genUi !== null && genUi.remaining === 0) {
      Alert.alert("Generation limit", "You’ve used all free AI generations for this month.");
      return;
    }
    void runGeneration({
      user_input: habit.context?.trim() || undefined,
    });
  }, [genUi, generating, habit, runGeneration, session?.user?.id]);

  const runRegeneratePlan = useCallback(() => {
    if (!habit || !session?.user?.id || generating || !habit.current_plan_id) return;
    if (!genUi?.isPaid && genUi !== null && genUi.remaining === 0) {
      Alert.alert("Generation limit", "You’ve used all free AI generations for this month.");
      return;
    }
    void runGeneration({
      user_input: habit.context?.trim() || undefined,
      regenerate_note: regenerateNote.trim() || undefined,
    });
  }, [genUi, generating, habit, regenerateNote, runGeneration, session?.user?.id]);

  const onToggleStep = useCallback(
    async (stepId: string, next: boolean) => {
      if (!habit || !session?.user?.id || !habit.current_plan_id) return;
      const userId = session.user.id;
      const snapshot = new Map(stepDoneTodayRef.current);
      const optimistic = new Map(stepDoneTodayRef.current);
      optimistic.set(stepId, next);
      setStepDoneToday(optimistic);
      const cached = getHabitDetailCache(userId, habit.id);
      if (cached) {
        setHabitDetailCache(userId, habit.id, {
          ...cached,
          stepDoneToday: Object.fromEntries(optimistic.entries()),
        });
      }

      const isSetup =
        parsedPlan != null ? isPrePlanStepId(parsedPlan, stepId) : false;
      const { error } = await upsertStepLog(
        habit.id,
        stepId,
        todayLogDateString(),
        next,
        isSetup
      );
      if (error) {
        setStepDoneToday(snapshot);
        if (cached) {
          setHabitDetailCache(userId, habit.id, {
            ...cached,
            stepDoneToday: Object.fromEntries(snapshot.entries()),
          });
        }
        Alert.alert("Could not save", error.message);
        return;
      }
      const [compRes, statsRes] = await Promise.all([
        fetchStepCompletionForDate(habit.id, todayLogDateString()),
        fetchHabitLogProgressStats(habit.id),
      ]);
      setStepDoneToday(compRes.data ?? optimistic);
      if (statsRes.data) {
        setLogStats(statsRes.data);
      }
      const prev = getHabitDetailCache(userId, habit.id);
      if (prev) {
        setHabitDetailCache(userId, habit.id, {
          ...prev,
          stepDoneToday: Object.fromEntries((compRes.data ?? optimistic).entries()),
          logStats: statsRes.data ?? prev.logStats,
        });
      }
    },
    [habit, parsedPlan, session?.user?.id]
  );

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
              invalidateHabitDetailCache(userId, habitId);
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
            disabled={generating}
          >
            <FontAwesome name="pencil" size={20} color={colors.text} />
          </HeaderButton>
          <HeaderButton
            onPress={requestDelete}
            accessibilityLabel="Delete habit"
            pressOpacity={0.5}
            disabled={!habit || deleting || generating}
          >
            <FontAwesome name="trash-o" size={20} color={colors.text} />
          </HeaderButton>
        </View>
      ),
    });
  }, [colors.text, deleting, generating, habit, id, navigation, requestDelete, router]);

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

  const hasPlan = Boolean(habit.current_plan_id && activePlanRow);

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.titleRow} lightColor="transparent" darkColor="transparent">
        <Text style={styles.title}>{habit.name}</Text>
        <View
          style={[styles.pill, { backgroundColor: theme.soft, borderColor: theme.border }]}
          lightColor="transparent"
          darkColor="transparent"
        >
          <Text style={styles.pillText} lightColor={theme.primary} darkColor={theme.primary}>
            {habit.type === "build" ? "Build" : "Break"}
          </Text>
        </View>
      </View>
      <Text style={styles.row} lightColor="#3f3f46" darkColor="#a1a1aa">
        Started: {formatStart(habit.start_date)}
      </Text>
      <Text style={styles.row} lightColor="#3f3f46" darkColor="#a1a1aa">
        Streak: {habitStreakLabel(habit)}
      </Text>

      {habit.context ? (
        <View style={styles.contextBox} lightColor="#f4f4f5" darkColor="rgba(255,255,255,0.06)">
          <Text style={styles.contextLabel} lightColor="#52525b" darkColor="#a1a1aa">
            Context
          </Text>
          <Text style={styles.contextBody}>{habit.context}</Text>
        </View>
      ) : null}

      <HabitTabBar active={activeTab} onChange={setActiveTab} accent={theme.primary} />

      {activeTab === "plan" ? (
        <PlanTabPanel
          habit={habit}
          themeKey={habit.type}
          hasPlan={hasPlan}
          parsedPlan={parsedPlan}
          planParseError={planParseError}
          genUi={genUi}
          generating={generating}
          regenerateNote={regenerateNote}
          onChangeRegenerateNote={setRegenerateNote}
          onGenerate={runGeneratePlan}
          onRegenerate={runRegeneratePlan}
          stepDoneToday={stepDoneTodayForActivePlan}
          onToggleStep={onToggleStep}
        />
      ) : null}

      {activeTab === "progress" ? (
        <ProgressTabPanel stats={logStats} habit={habit} />
      ) : null}

      {activeTab === "history" ? (
        <HistoryTabPanel versions={planVersions} isPaid={Boolean(genUi?.isPaid)} />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 20, paddingBottom: 40, maxWidth: 480, width: "100%", alignSelf: "center" },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    gap: 8,
  },
  pill: {
    alignSelf: "flex-start",
    flexShrink: 0,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: { fontSize: 13, fontWeight: "600" },
  title: { flex: 1, minWidth: 0, fontSize: 24, fontWeight: "700" },
  row: { fontSize: 16, lineHeight: 24, marginBottom: 4 },
  contextBox: {
    marginTop: 10,
    marginBottom: 10,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1.5,
    borderColor: "rgba(120,120,128,0.45)",
  },
  contextLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  contextBody: { fontSize: 16, lineHeight: 24 },
  padded: { flex: 1, padding: 20 },
  error: { color: "#b91c1c", marginBottom: 12 },
  link: { color: "#2f95dc", fontSize: 16, fontWeight: "500" },
  muted: { fontSize: 16, marginBottom: 12 },
  headerActions: { flexDirection: "row", alignItems: "center" },
});
