import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import { productTheme } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { getAiGenerationUiState, type AiGenerationUiState } from "@/lib/aiGeneration";
import { toISODateString } from "@/lib/dates";
import { createHabit } from "@/lib/habits";
import { hrefHabitDetail } from "@/lib/href";
import { generateAndAttachPlan } from "@/lib/planGeneration";
import { createHabitSchema, type CreateHabitInput } from "@/lib/validation/habit";
import type { HabitType } from "@/types/habit";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View as RNView,
  ScrollView,
  StyleSheet,
  TextInput,
} from "react-native";

const typeOptions: { value: HabitType; label: string }[] = [
  { value: "build", label: "Build" },
  { value: "break", label: "Break" },
];

function normalizeType(raw: string | string[] | undefined): HabitType {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "break" ? "break" : "build";
}

export default function NewHabitScreen() {
  const { type: typeParam } = useLocalSearchParams<{ type?: string }>();
  const defaultType = useMemo(() => normalizeType(typeParam), [typeParam]);
  const { session } = useAuth();
  const router = useRouter();
  const scheme = useColorScheme() ?? "light";
  const [submitting, setSubmitting] = useState(false);
  const [busyHint, setBusyHint] = useState<string | null>(null);
  const [genUi, setGenUi] = useState<AiGenerationUiState | null>(null);
  const [startDate, setStartDate] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const border = scheme === "dark" ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.12)";

  const { control, handleSubmit, watch, setValue } = useForm<CreateHabitInput>({
    defaultValues: {
      name: "",
      type: defaultType,
      start_date: toISODateString(new Date()),
      context: "",
    },
  });
  const habitType = watch("type");

  useEffect(() => {
    setValue("type", defaultType, { shouldValidate: true });
  }, [defaultType, setValue]);

  useEffect(() => {
    if (!session?.user?.id) return;
    void (async () => {
      const { data } = await getAiGenerationUiState(session.user.id);
      setGenUi(data);
    })();
  }, [session?.user?.id]);

  const syncDate = useCallback(
    (d: Date) => {
      setStartDate(d);
      setValue("start_date", toISODateString(d), { shouldValidate: true });
    },
    [setValue]
  );

  const onValid = async (data: CreateHabitInput) => {
    if (!session?.user?.id) {
      Alert.alert("Sign in required", "You need to be signed in to create a habit.");
      return;
    }
    setSubmitting(true);
    setBusyHint("Saving habit…");
    const parsed = createHabitSchema.safeParse(data);
    if (!parsed.success) {
      setSubmitting(false);
      setBusyHint(null);
      Alert.alert("Check fields", parsed.error.issues[0]?.message ?? "Invalid data");
      return;
    }
    const { data: created, error } = await createHabit(session.user.id, parsed.data);
    if (error || !created) {
      setSubmitting(false);
      setBusyHint(null);
      Alert.alert("Could not save", error?.message ?? "Unknown error");
      return;
    }

    const knownLimitReached = !genUi?.isPaid && genUi !== null && genUi.remaining === 0;
    if (knownLimitReached) {
      setSubmitting(false);
      setBusyHint(null);
      router.replace(hrefHabitDetail(created.id));
      return;
    }

    setBusyHint("Generating plan…");
    const ctx = parsed.data.context?.trim();
    const planResult = await generateAndAttachPlan(session.user.id, created.id, {
      user_input: ctx ? ctx : undefined,
    });
    setSubmitting(false);
    setBusyHint(null);

    if (planResult.error) {
      if (planResult.limitInfo) {
        Alert.alert(
          "Generation limit",
          `${planResult.error.message} You can open the habit and try again next month, or upgrade when available.`
        );
      } else {
        Alert.alert(
          "Plan not generated",
          `${planResult.error.message} Your habit was saved — open it and tap Generate Plan to retry.`
        );
      }
    }

    if (session?.user?.id) {
      const { data: ui } = await getAiGenerationUiState(session.user.id);
      setGenUi(ui);
    }

    router.replace(hrefHabitDetail(created.id));
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Name</Text>
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder={
                habitType === "break"
                  ? "e.g. Bedtime scrolling"
                  : "e.g. Morning walk"
              }
              placeholderTextColor="#888"
              style={[
                styles.input,
                { borderColor: border, color: scheme === "dark" ? "#fff" : "#000" },
              ]}
              autoCorrect
              maxLength={200}
            />
          )}
        />

        <Text style={styles.label}>Type</Text>
        <View style={styles.typeRow} lightColor="transparent" darkColor="transparent">
          {typeOptions.map((t) => {
            const active = habitType === t.value;
            const accent = productTheme[t.value].primary;
            return (
              <Pressable
                key={t.value}
                onPress={() => setValue("type", t.value, { shouldValidate: true })}
                style={[
                  styles.typeChip,
                  {
                    borderColor: active ? accent : border,
                    backgroundColor: active
                      ? t.value === "build"
                        ? productTheme.build.soft
                        : productTheme.break.soft
                      : "transparent",
                  },
                ]}
              >
                <Text style={styles.typeChipText}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Start date</Text>
        <>
          {Platform.OS === "android" && (
            <Pressable
              onPress={() => setShowDatePicker(true)}
              style={({ pressed }) => [styles.dateBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={styles.dateBtnText}>{toISODateString(startDate)}</Text>
            </Pressable>
          )}
          {Platform.OS === "ios" && (
            <RNView
              style={[
                styles.datePickerWell,
                { backgroundColor: scheme === "dark" ? "#1c1c1e" : "#f2f2f7" },
              ]}
            >
              <DateTimePicker
                value={startDate}
                mode="date"
                display="spinner"
                themeVariant={scheme === "dark" ? "dark" : "light"}
                onChange={(_, d) => {
                  if (d) syncDate(d);
                }}
              />
            </RNView>
          )}
          {Platform.OS === "android" && showDatePicker && (
            <DateTimePicker
              value={startDate}
              mode="date"
              onChange={(_, d) => {
                setShowDatePicker(false);
                if (d) syncDate(d);
              }}
            />
          )}
        </>

        <Text style={styles.label}>Context (optional)</Text>
        <Text style={styles.hint} lightColor="#666" darkColor="#999">
          Sent to the model when your first plan is generated.
        </Text>
        <Controller
          control={control}
          name="context"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              value={value ?? ""}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder={
                habitType === "break"
                  ? "e.g. Bored, anxious, or can't sleep—then you grab the phone"
                  : "e.g. Same time most days; rain or a rough night and you skip"
              }
              placeholderTextColor="#888"
              style={[
                styles.textArea,
                { borderColor: border, color: scheme === "dark" ? "#fff" : "#000" },
              ]}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={2000}
            />
          )}
        />

        {genUi && !genUi.isPaid && genUi.remaining === 0 ? (
          <Text style={styles.usageWarn} lightColor="#b91c1c" darkColor="#f87171">
            You have no AI generations left this month. You can still save the habit and generate a plan later if your limit resets or you upgrade.
          </Text>
        ) : null}
        {genUi && !genUi.isPaid ? (
          <Text style={styles.usageNote} lightColor="#52525b" darkColor="#a1a1aa">
            AI generations left this month: {genUi.remaining ?? 0} of {genUi.cap}
          </Text>
        ) : null}

        <Pressable
          onPress={handleSubmit(onValid)}
          disabled={submitting}
          style={({ pressed }) => [
            styles.save,
            {
              backgroundColor: productTheme[habitType].primary,
              opacity: pressed || submitting ? 0.7 : 1,
            },
          ]}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text lightColor="#fff" darkColor="#0f172a" style={styles.saveText}>
              {genUi && !genUi.isPaid && genUi.remaining === 0 ? "Save" : "Save & Generate Plan"}
            </Text>
          )}
        </Pressable>
        {busyHint ? (
          <Text style={styles.busyHint} lightColor="#52525b" darkColor="#a1a1aa">
            {busyHint}
          </Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, maxWidth: 480, width: "100%", alignSelf: "center" },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  hint: { fontSize: 12, marginBottom: 6 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
  },
  typeRow: { flexDirection: "row", gap: 10, marginTop: 4, flexWrap: "wrap" },
  typeChip: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1 },
  typeChipText: { fontSize: 16, fontWeight: "500" },
  dateBtn: { paddingVertical: 10, paddingHorizontal: 4, marginBottom: 4 },
  dateBtnText: { fontSize: 16 },
  datePickerWell: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 4,
    width: "100%",
    alignItems: "center",
    paddingVertical: 4,
  },
  save: { marginTop: 24, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  saveText: { fontSize: 16, fontWeight: "600" },
  usageWarn: { fontSize: 13, marginTop: 16, marginBottom: 8, lineHeight: 18 },
  usageNote: { fontSize: 13, marginTop: 16, marginBottom: 4 },
  busyHint: { fontSize: 13, marginTop: 10, textAlign: "center" },
});
