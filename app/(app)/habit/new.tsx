import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import { productTheme } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { toISODateString } from "@/lib/dates";
import { createHabit } from "@/lib/habits";
import { hrefHabitDetail } from "@/lib/href";
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
    const parsed = createHabitSchema.safeParse(data);
    if (!parsed.success) {
      setSubmitting(false);
      Alert.alert("Check fields", parsed.error.issues[0]?.message ?? "Invalid data");
      return;
    }
    const { data: created, error } = await createHabit(session.user.id, parsed.data);
    setSubmitting(false);
    if (error || !created) {
      Alert.alert("Could not save", error?.message ?? "Unknown error");
      return;
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
          Notes for the AI when you generate a plan (Phase 6).
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
              Save habit
            </Text>
          )}
        </Pressable>
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
});
