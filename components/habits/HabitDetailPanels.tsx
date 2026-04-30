import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import { productTheme } from "@/constants/theme";
import type { AiGenerationUiState } from "@/lib/aiGeneration";
import type { HabitLogProgressStats } from "@/lib/habitLogs";
import type { AiPlanJson } from "@/schemas/aiPlan.zod";
import type { Habit } from "@/types/habit";
import type { HabitPlanRow } from "@/types/habitPlan";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  View as RNView,
  StyleSheet,
  TextInput,
} from "react-native";

import { formatWeekdayList } from "@/lib/weekdays";

const DIFFICULTY_CHIP: Record<
  "easy" | "medium" | "hard",
  { bgLight: string; bgDark: string; border: string; textLight: string; textDark: string }
> = {
  easy: {
    bgLight: "#dcfce7",
    bgDark: "rgba(34,197,94,0.22)",
    border: "#22c55e",
    textLight: "#166534",
    textDark: "#86efac",
  },
  medium: {
    bgLight: "#fef9c3",
    bgDark: "rgba(234,179,8,0.22)",
    border: "#ca8a04",
    textLight: "#854d0e",
    textDark: "#fde047",
  },
  hard: {
    bgLight: "#fee2e2",
    bgDark: "rgba(239,68,68,0.22)",
    border: "#ef4444",
    textLight: "#991b1b",
    textDark: "#fca5a5",
  },
};

export type DetailTab = "plan" | "progress" | "history";

export function HabitTabBar(props: {
  active: DetailTab;
  onChange: (t: DetailTab) => void;
  accent: string;
}) {
  const tabs: { id: DetailTab; label: string }[] = [
    { id: "plan", label: "Plan" },
    { id: "progress", label: "Progress" },
    { id: "history", label: "History" },
  ];
  return (
    <RNView style={styles.tabRow}>
      {tabs.map((t) => {
        const on = props.active === t.id;
        return (
          <Pressable
            key={t.id}
            onPress={() => props.onChange(t.id)}
            style={[styles.tabBtn, on && { borderBottomColor: props.accent, borderBottomWidth: 2 }]}
          >
            <Text
              style={[styles.tabLabel, on ? { color: props.accent, fontWeight: "700" } : { opacity: 0.65 }]}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </RNView>
  );
}

export type PlanTabPanelProps = {
  habit: Habit;
  themeKey: "build" | "break";
  hasPlan: boolean;
  parsedPlan: AiPlanJson | null;
  planParseError: string | null;
  genUi: AiGenerationUiState | null;
  generating: boolean;
  regenerateNote: string;
  onChangeRegenerateNote: (s: string) => void;
  onGenerate: () => void;
  onRegenerate: () => void;
  stepDoneToday: Map<string, boolean>;
  onToggleStep: (stepId: string, next: boolean) => void;
};

function PlanTabPanelBody(props: PlanTabPanelProps & { plan: AiPlanJson }) {
  const colorScheme = useColorScheme() ?? "light";
  const theme = productTheme[props.themeKey];
  /** Today-tab blue — same for build & break so setup tasks read as “Today” work. */
  const todayTheme = productTheme.today;
  const plan = props.plan;

  const difficultyLabel =
    plan.difficulty === "easy"
      ? "Easy"
      : plan.difficulty === "medium"
        ? "Medium"
        : "Hard";

  const chip = DIFFICULTY_CHIP[plan.difficulty];

  const hasPrePlan =
    plan.pre_plan_steps.length > 0 && plan.setup_estimated_minutes != null;
  const setupComplete =
    !hasPrePlan || plan.pre_plan_steps.every((p) => props.stepDoneToday.get(p.id) === true);

  const planStepIdKey = useMemo(
    () =>
      plan.pre_plan_steps.map((p) => p.id).join(",") + "|" + plan.steps.map((s) => s.id).join(","),
    [plan.pre_plan_steps, plan.steps]
  );

  type SetupDisplayPhase = "setup" | "fading" | "celebration" | "recurring";
  const [setupDisplayPhase, setSetupDisplayPhase] = useState<SetupDisplayPhase>(() => {
    const hp =
      plan.pre_plan_steps.length > 0 && plan.setup_estimated_minutes != null;
    if (!hp) return "recurring";
    const done = plan.pre_plan_steps.every((p) => props.stepDoneToday.get(p.id) === true);
    return done ? "recurring" : "setup";
  });
  const setupFadeAnim = useRef(new Animated.Value(1)).current;
  const celebrateAnim = useRef(new Animated.Value(0)).current;
  const recurringFadeAnim = useRef(new Animated.Value(1)).current;
  const fadeInRecurringAfterCelebrationRef = useRef(false);
  const planKeyRef = useRef<string>("");
  const prevSetupCompleteRef = useRef<boolean | null>(null);
  const setupDisplayPhaseRef = useRef<SetupDisplayPhase>("recurring");
  setupDisplayPhaseRef.current = setupDisplayPhase;

  useEffect(() => {
    if (planKeyRef.current !== planStepIdKey) {
      planKeyRef.current = planStepIdKey;
      prevSetupCompleteRef.current = null;
      setupFadeAnim.setValue(1);
      celebrateAnim.setValue(0);
      recurringFadeAnim.setValue(1);
      fadeInRecurringAfterCelebrationRef.current = false;
      const done =
        !hasPrePlan ||
        plan.pre_plan_steps.every((p) => props.stepDoneToday.get(p.id) === true);
      setSetupDisplayPhase(!hasPrePlan || done ? "recurring" : "setup");
      return;
    }

    const done = setupComplete;

    if (hasPrePlan && !done && setupDisplayPhaseRef.current === "recurring") {
      setSetupDisplayPhase("setup");
      setupFadeAnim.setValue(1);
      prevSetupCompleteRef.current = done;
      return;
    }

    if (prevSetupCompleteRef.current === null) {
      prevSetupCompleteRef.current = done;
      return;
    }

    if (
      setupDisplayPhaseRef.current === "setup" &&
      prevSetupCompleteRef.current === false &&
      done === true
    ) {
      setSetupDisplayPhase("fading");
      setupFadeAnim.setValue(1);
      Animated.timing(setupFadeAnim, {
        toValue: 0,
        duration: 420,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setSetupDisplayPhase("celebration");
          celebrateAnim.setValue(0);
          Animated.timing(celebrateAnim, {
            toValue: 1,
            duration: 280,
            useNativeDriver: true,
          }).start();
        }
      });
    }

    prevSetupCompleteRef.current = done;
  }, [
    planStepIdKey,
    hasPrePlan,
    setupComplete,
    plan.pre_plan_steps,
    props.stepDoneToday,
  ]);

  useEffect(() => {
    if (setupDisplayPhase !== "celebration") return;
    const t = setTimeout(() => {
      celebrateAnim.setValue(0);
      setupFadeAnim.setValue(1);
      fadeInRecurringAfterCelebrationRef.current = true;
      recurringFadeAnim.setValue(0);
      setSetupDisplayPhase("recurring");
    }, 1500);
    return () => clearTimeout(t);
  }, [setupDisplayPhase]);

  useEffect(() => {
    if (!hasPrePlan) {
      recurringFadeAnim.setValue(1);
      return;
    }
    if (setupDisplayPhase !== "recurring") return;

    if (fadeInRecurringAfterCelebrationRef.current) {
      fadeInRecurringAfterCelebrationRef.current = false;
      Animated.timing(recurringFadeAnim, {
        toValue: 1,
        duration: 480,
        useNativeDriver: true,
      }).start();
    } else {
      recurringFadeAnim.setValue(1);
    }
  }, [setupDisplayPhase, hasPrePlan]);

  const showSetupBlock =
    hasPrePlan && (setupDisplayPhase === "setup" || setupDisplayPhase === "fading");
  const showCelebration = hasPrePlan && setupDisplayPhase === "celebration";
  const showRecurringBlock = !hasPrePlan || setupDisplayPhase === "recurring";

  const checklistInteractionLocked =
    setupDisplayPhase === "fading" || setupDisplayPhase === "celebration";

  return (
    <View style={styles.panel} lightColor="transparent" darkColor="transparent">
      <View style={styles.summaryBox} lightColor="#f4f4f5" darkColor="rgba(255,255,255,0.06)">
        <Text style={styles.summarySectionTitle} lightColor="#52525b" darkColor="#a1a1aa">
          Summary
        </Text>
        <Text style={styles.summaryBody}>{plan.summary}</Text>
        <RNView style={styles.summaryMetaRows}>
          <RNView style={styles.summaryMetaRow}>
            <Text
              style={[styles.summarySectionTitle, styles.summaryFieldLabel]}
              lightColor="#52525b"
              darkColor="#a1a1aa"
            >
              Estimated duration
            </Text>
            <Text style={styles.summaryMetaValue} lightColor="#52525b" darkColor="#a1a1aa">
              {plan.estimated_duration_days} days
            </Text>
          </RNView>
          <RNView style={styles.summaryMetaRow}>
            <Text
              style={[styles.summarySectionTitle, styles.summaryFieldLabel]}
              lightColor="#52525b"
              darkColor="#a1a1aa"
            >
              Difficulty
            </Text>
            <View
              style={[styles.difficultyChip, { borderColor: chip.border }]}
              lightColor={chip.bgLight}
              darkColor={chip.bgDark}
            >
              <Text
                style={styles.difficultyChipText}
                lightColor={chip.textLight}
                darkColor={chip.textDark}
              >
                {difficultyLabel}
              </Text>
            </View>
          </RNView>
        </RNView>
      </View>

      {props.habit.type === "break" && plan.triggers.length > 0 ? (
        <View
          style={[
            styles.triggersBox,
            {
              borderColor:
                colorScheme === "dark" ? "rgba(248, 113, 113, 0.45)" : "#fecaca",
            },
          ]}
          lightColor="#fef2f2"
          darkColor="rgba(248,113,113,0.12)"
        >
          <Text
            style={[styles.summarySectionTitle, styles.triggersTitle]}
            lightColor="#991b1b"
            darkColor="#fca5a5"
          >
            Possible Triggers
          </Text>
          {plan.triggers.map((tr, i) => (
            <Text key={i} style={styles.triggerLine} lightColor="#991b1b" darkColor="#fca5a5">
              • {tr}
            </Text>
          ))}
        </View>
      ) : null}

      {showSetupBlock ? (
        <Animated.View style={{ opacity: setupFadeAnim }}>
          <RNView style={styles.setupTitleRow}>
            <Text style={[styles.stepsHeading, styles.setupHeadingInline]}>Setup</Text>
            <View
              style={styles.setupTitleDivider}
              lightColor="#d4d4d8"
              darkColor="#52525b"
            />
            <Text
              style={styles.setupTimeEstimate}
              lightColor="#71717a"
              darkColor="#a1a1aa"
            >
              About {plan.setup_estimated_minutes} min
            </Text>
          </RNView>
          <Text style={styles.stepsHint} lightColor="#71717a" darkColor="#a1a1aa">
            Complete these first—they're required before you can follow the rest of the plan effectively.
          </Text>
          {plan.pre_plan_steps.map((pre) => {
            const done = props.stepDoneToday.get(pre.id) === true;
            return (
              <Pressable
                key={pre.id}
                disabled={checklistInteractionLocked}
                onPress={() => props.onToggleStep(pre.id, !done)}
                style={({ pressed }) => [
                  styles.stepRow,
                  {
                    opacity: pressed && !checklistInteractionLocked ? 0.85 : 1,
                    borderColor: todayTheme.border,
                    backgroundColor: todayTheme.soft,
                  },
                ]}
              >
                <RNView style={styles.stepCheckSlot}>
                  <FontAwesome
                    name={done ? "check-square" : "square-o"}
                    size={22}
                    color={todayTheme.primary}
                  />
                </RNView>
                <View style={styles.stepBody} lightColor="transparent" darkColor="transparent">
                  <Text style={styles.stepTitle}>{pre.title}</Text>
                  {pre.description.trim() !== pre.title.trim() ? (
                    <Text style={styles.stepDesc} lightColor="#52525b" darkColor="#a1a1aa">
                      {pre.description}
                    </Text>
                  ) : null}
                  <Text
                    style={styles.stepFreq}
                    lightColor={todayTheme.strong}
                    darkColor="#7dd3fc"
                  >
                    One time
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </Animated.View>
      ) : null}

      {showCelebration ? (
        <RNView style={styles.celebrateSlot}>
          <Animated.View
            style={[
              styles.celebrateCard,
              {
                opacity: celebrateAnim,
                borderColor: theme.border,
                backgroundColor: theme.soft,
              },
            ]}
          >
            <FontAwesome name="check-circle" size={40} color={theme.primary} style={styles.celebrateIcon} />
            <Text style={styles.celebrateTitle} lightColor="#18181b" darkColor="#fafafa">
              Nice work!
            </Text>
            <Text style={styles.celebrateSubtitle} lightColor="#52525b" darkColor="#a1a1aa">
              Now you're ready for your plan.
            </Text>
          </Animated.View>
        </RNView>
      ) : null}

      {showRecurringBlock ? (
        <Animated.View style={{ opacity: recurringFadeAnim }}>
          <Text style={styles.stepsHeading}>Your Plan</Text>
          <Text style={styles.stepsHint} lightColor="#71717a" darkColor="#a1a1aa">
            {hasPrePlan
              ? `Tap to log today (${new Date().toLocaleDateString()}).`
              : `Tap to log today (${new Date().toLocaleDateString()}). Same steps appear on Today in the next phase.`}
          </Text>

          {plan.steps.map((step) => {
            const done = props.stepDoneToday.get(step.id) === true;
            return (
              <Pressable
                key={step.id}
                onPress={() => props.onToggleStep(step.id, !done)}
                style={({ pressed }) => [
                  styles.stepRow,
                  { opacity: pressed ? 0.85 : 1, borderColor: theme.border },
                ]}
              >
                <RNView style={styles.stepCheckSlot}>
                  <FontAwesome
                    name={done ? "check-square" : "square-o"}
                    size={22}
                    color={theme.primary}
                  />
                </RNView>
                <View style={styles.stepBody} lightColor="transparent" darkColor="transparent">
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  {step.description.trim() !== step.title.trim() ? (
                    <Text style={styles.stepDesc} lightColor="#52525b" darkColor="#a1a1aa">
                      {step.description}
                    </Text>
                  ) : null}
                  <Text style={styles.stepFreq} lightColor="#71717a" darkColor="#71717a">
                    {step.frequency === "daily"
                      ? "Daily"
                      : step.frequency === "weekly"
                        ? `Weekly · ${step.weekdays ? formatWeekdayList(step.weekdays) : ""}`
                        : "Monthly"}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </Animated.View>
      ) : null}

      <Text style={styles.regenHeading}>Regenerate Plan</Text>
      <Text style={styles.regenHint} lightColor="#71717a" darkColor="#a1a1aa">
        Get a new plan if this one is not working for you. It replaces the plan you have now, and you may
        need to work through setup and your steps again if the tasks change.
      </Text>
      {props.genUi && !props.genUi.isPaid ? (
        <Text style={styles.usageNote} lightColor="#52525b" darkColor="#a1a1aa">
          AI generations left: {props.genUi.remaining ?? 0} of {props.genUi.cap}
        </Text>
      ) : null}
      <TextInput
        value={props.regenerateNote}
        onChangeText={props.onChangeRegenerateNote}
        placeholder="Optional notes for the AI (what to change, constraints…)"
        placeholderTextColor="#888"
        style={styles.regenInput}
        multiline
      />
      <Pressable
        onPress={props.onRegenerate}
        disabled={props.generating}
        style={({ pressed }) => [
          styles.actionBtn,
          { backgroundColor: theme.primary, opacity: pressed || props.generating ? 0.7 : 1 },
        ]}
      >
        {props.generating ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text lightColor="#fff" darkColor="#0f172a" style={styles.actionBtnText}>
            Regenerate Plan
          </Text>
        )}
      </Pressable>
    </View>
  );
}

export function PlanTabPanel(props: PlanTabPanelProps) {
  const theme = productTheme[props.themeKey];

  if (!props.hasPlan) {
    return (
      <View style={styles.panel} lightColor="transparent" darkColor="transparent">
        <Text style={styles.panelLead} lightColor="#52525b" darkColor="#a1a1aa">
          Generate an AI plan to get structured steps for this habit.
        </Text>
        {props.genUi && !props.genUi.isPaid && props.genUi.remaining === 0 ? (
          <Text style={styles.usageWarn} lightColor="#b91c1c" darkColor="#f87171">
            You have no AI generations left this month. You can still keep this habit and generate a
            plan later if your limit resets or you upgrade.
          </Text>
        ) : null}
        {props.genUi && !props.genUi.isPaid ? (
          <Text style={styles.usageNote} lightColor="#52525b" darkColor="#a1a1aa">
            AI generations left this month: {props.genUi.remaining ?? 0} of {props.genUi.cap}
          </Text>
        ) : null}
        <Pressable
          onPress={props.onGenerate}
          disabled={props.generating}
          style={({ pressed }) => [
            styles.actionBtn,
            { backgroundColor: theme.primary, opacity: pressed || props.generating ? 0.75 : 1 },
          ]}
        >
          {props.generating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text lightColor="#fff" darkColor="#0f172a" style={styles.actionBtnText}>
              Generate Plan
            </Text>
          )}
        </Pressable>
      </View>
    );
  }

  if (props.planParseError || !props.parsedPlan) {
    return (
      <View style={styles.panel} lightColor="transparent" darkColor="transparent">
        <Text style={styles.warn}>
          {props.planParseError ?? "Could not read this plan. Try regenerating."}
        </Text>
      </View>
    );
  }

  return <PlanTabPanelBody {...props} plan={props.parsedPlan} />;
}

export function ProgressTabPanel(props: {
  stats: HabitLogProgressStats | null;
  habit: Habit;
}) {
  const s = props.stats;
  return (
    <View style={styles.panel} lightColor="transparent" darkColor="transparent">
      <Text style={styles.panelLead} lightColor="#52525b" darkColor="#a1a1aa">
        Tracking for this habit (from your completion logs).
      </Text>
      {!props.habit.current_plan_id ? (
        <Text style={styles.usageWarn} lightColor="#b91c1c" darkColor="#f87171">
          Generate a plan to unlock step checklists on the Plan tab.
        </Text>
      ) : null}
      <View style={styles.statCard} lightColor="#f4f4f5" darkColor="rgba(255,255,255,0.06)">
        <Text style={styles.statNum}>{s?.completedEntries ?? 0}</Text>
        <Text style={styles.statLabel} lightColor="#52525b" darkColor="#a1a1aa">
          Completed step logs
        </Text>
      </View>
      <View style={styles.statCard} lightColor="#f4f4f5" darkColor="rgba(255,255,255,0.06)">
        <Text style={styles.statNum}>{s?.distinctCompletedDays ?? 0}</Text>
        <Text style={styles.statLabel} lightColor="#52525b" darkColor="#a1a1aa">
          Days with at least one completion
        </Text>
      </View>
    </View>
  );
}

export function HistoryTabPanel(props: {
  versions: HabitPlanRow[];
  isPaid: boolean;
}) {
  const sorted = [...props.versions].sort((a, b) => b.version - a.version);

  if (!props.isPaid) {
    const current = sorted.find((v) => v.is_active);
    const hidden = sorted.filter((v) => !v.is_active).length;
    return (
      <View style={styles.panel} lightColor="transparent" darkColor="transparent">
        <View style={styles.lockedBanner} lightColor="#fef3c7" darkColor="rgba(234,179,8,0.15)">
          <Text style={styles.lockedTitle}>Free tier</Text>
          <Text style={styles.lockedBody} lightColor="#92400e" darkColor="#fcd34d">
            Past plan versions are available for subscribers. You can always see and use your current
            plan on the Plan tab.
          </Text>
        </View>
        {current ? (
          <View style={styles.versionRow} lightColor="#f4f4f5" darkColor="rgba(255,255,255,0.06)">
            <Text style={styles.versionTitle}>Version {current.version} (current)</Text>
            <Text style={styles.versionDate} lightColor="#71717a" darkColor="#a1a1aa">
              {new Date(current.created_at).toLocaleString()}
            </Text>
          </View>
        ) : null}
        {sorted.length === 0 ? (
          <Text style={styles.panelLead} lightColor="#52525b" darkColor="#a1a1aa">
            No saved plans yet.
          </Text>
        ) : null}
        {hidden > 0 ? (
          <Text style={styles.hiddenNote} lightColor="#52525b" darkColor="#a1a1aa">
            {hidden} older version{hidden === 1 ? "" : "s"} hidden
          </Text>
        ) : null}
      </View>
    );
  }

  if (sorted.length === 0) {
    return (
      <View style={styles.panel} lightColor="transparent" darkColor="transparent">
        <Text style={styles.panelLead} lightColor="#52525b" darkColor="#a1a1aa">
          No saved plans yet.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.panel} lightColor="transparent" darkColor="transparent">
      {sorted.map((v) => (
        <View key={v.id} style={styles.versionRow} lightColor="#f4f4f5" darkColor="rgba(255,255,255,0.06)">
          <Text style={styles.versionTitle}>
            Version {v.version}
            {v.is_active ? " · Active" : ""}
          </Text>
          <Text style={styles.versionDate} lightColor="#71717a" darkColor="#a1a1aa">
            {new Date(v.created_at).toLocaleString()}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(120,120,128,0.2)",
    marginBottom: 16,
    backgroundColor: "transparent",
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  tabLabel: { fontSize: 15 },
  panel: { paddingBottom: 24 },
  panelLead: { fontSize: 15, lineHeight: 22, marginBottom: 12 },
  summaryBox: {
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: "rgba(120,120,128,0.45)",
  },
  summarySectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryBody: { fontSize: 16, lineHeight: 24, marginBottom: 12 },
  summaryMetaRows: { alignSelf: "stretch", marginTop: 8, gap: 10 },
  summaryMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  /** Same typography as Summary heading; no extra bottom margin inside meta rows. */
  summaryFieldLabel: { marginBottom: 0, flexShrink: 1 },
  summaryMetaValue: { fontSize: 14, lineHeight: 20, fontWeight: "500", textAlign: "right" },
  difficultyChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  difficultyChipText: { fontSize: 13, fontWeight: "600" },
  triggersBox: {
    borderRadius: 10,
    borderWidth: 1.5,
    padding: 12,
    marginBottom: 10,
  },
  /** Overrides summarySectionTitle margin for tighter gap above bullet list. */
  triggersTitle: { marginBottom: 6 },
  triggerLine: { fontSize: 15, lineHeight: 22 },
  celebrateSlot: {
    minHeight: 200,
    justifyContent: "center",
    marginBottom: 8,
  },
  celebrateCard: {
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    alignSelf: "center",
    maxWidth: 320,
    width: "100%",
  },
  celebrateIcon: { marginBottom: 12 },
  celebrateTitle: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  celebrateSubtitle: { fontSize: 14, lineHeight: 20, marginTop: 8, textAlign: "center", paddingHorizontal: 8 },
  stepsHeading: { fontSize: 18, fontWeight: "700", marginTop: 8, marginBottom: 4 },
  setupTitleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 8,
    rowGap: 4,
    marginTop: 8,
    marginBottom: 4,
  },
  setupTitleDivider: {
    width: 1,
    height: 18,
    alignSelf: "center",
  },
  setupHeadingInline: { marginTop: 0, marginBottom: 0 },
  setupTimeEstimate: { fontSize: 15, fontStyle: "italic", fontWeight: "400" },
  stepsHint: { fontSize: 12, marginBottom: 12, lineHeight: 18 },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1.5,
    borderColor: "rgba(120,120,128,0.45)",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  /** Fixed width so unchecked vs checked glyphs don’t shift the row text. */
  stepCheckSlot: {
    width: 26,
    marginRight: 10,
    marginTop: 2,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  stepBody: { flex: 1 },
  stepTitle: { fontSize: 16, fontWeight: "600" },
  stepDesc: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  stepFreq: { fontSize: 12, marginTop: 6 },
  regenHeading: { fontSize: 18, fontWeight: "700", marginTop: 10, marginBottom: 6 },
  regenHint: { fontSize: 12, lineHeight: 17, marginBottom: 8 },
  regenInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120,120,128,0.35)",
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    minHeight: 72,
    textAlignVertical: "top",
    marginBottom: 12,
  },
  actionBtn: {
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: { fontSize: 16, fontWeight: "600" },
  usageWarn: { fontSize: 13, marginBottom: 10, lineHeight: 18 },
  usageNote: { fontSize: 13, marginBottom: 10, lineHeight: 18 },
  warn: { color: "#b45309", fontSize: 14, lineHeight: 20 },
  statCard: {
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    alignItems: "center",
  },
  statNum: { fontSize: 28, fontWeight: "700" },
  statLabel: { fontSize: 14, marginTop: 4, textAlign: "center" },
  lockedBanner: { borderRadius: 10, padding: 14, marginBottom: 16 },
  lockedTitle: { fontWeight: "700", marginBottom: 6, fontSize: 15 },
  lockedBody: { fontSize: 14, lineHeight: 20 },
  versionRow: { borderRadius: 10, padding: 14, marginBottom: 10 },
  versionTitle: { fontSize: 16, fontWeight: "600" },
  versionDate: { fontSize: 13, marginTop: 4 },
  hiddenNote: { fontSize: 13, marginTop: 8 },
});
