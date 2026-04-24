import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import { productTheme } from "@/constants/theme";
import { toISODateString } from "@/lib/dates";
import { getHabitById, updateHabit } from "@/lib/habits";
import { hrefHabitDetail } from "@/lib/href";
import { updateHabitSchema, type UpdateHabitInput } from "@/lib/validation/habit";
import { useAuth } from "@/contexts/AuthContext";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useNavigation } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
import type { Habit } from "@/types/habit";

export default function EditHabitScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { session } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();
  const scheme = useColorScheme() ?? "light";
  const [habit, setHabit] = useState<Habit | null>(null);
  const [loading, setLoading] = useState(true);
  /** iOS: date wheel must layout before we show the form; Android: set when data is ready. */
  const [contentVisible, setContentVisible] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [startDate, setStartDate] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const border = scheme === "dark" ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.12)";

  const prevIdForOverlayRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (id == null) return;
    if (prevIdForOverlayRef.current === id) return;
    prevIdForOverlayRef.current = id;
    if (Platform.OS === "ios") setContentVisible(false);
  }, [id]);

  const { control, handleSubmit, setValue, reset } = useForm<UpdateHabitInput>({
    defaultValues: { name: "", start_date: toISODateString(new Date()) },
  });

  const loadHabit = useCallback(async () => {
    if (!session?.user?.id || !id) {
      setLoading(false);
      return;
    }
    setErr(null);
    setLoading(true);
    const { data, error: fetchError } = await getHabitById(session.user.id, id);
    setLoading(false);
    if (fetchError) {
      setErr(fetchError.message);
      setHabit(null);
      return;
    }
    if (!data) {
      setHabit(null);
      setErr("Habit not found");
      return;
    }
    setHabit(data);
    const d = new Date(data.start_date + "T12:00:00");
    setStartDate(d);
    reset({ name: data.name, start_date: data.start_date });
  }, [session?.user?.id, id, reset]);

  useEffect(() => {
    void loadHabit();
  }, [loadHabit]);

  useEffect(() => {
    if (loading || !habit) {
      return;
    }
    if (Platform.OS !== "ios") {
      setContentVisible(true);
    }
  }, [loading, habit]);

  /** iOS: safety net if date wheel onLayout never runs (intermittent native layout). */
  useEffect(() => {
    if (Platform.OS !== "ios" || loading || !habit) {
      return;
    }
    const t = setTimeout(() => {
      setContentVisible(true);
    }, 500);
    return () => clearTimeout(t);
  }, [loading, habit]);

  const accent = habit ? productTheme[habit.type] : productTheme.build;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Edit",
      headerBackTitleVisible: false,
    });
  }, [navigation]);

  const syncDate = useCallback(
    (d: Date) => {
      setStartDate(d);
      setValue("start_date", toISODateString(d), { shouldValidate: true });
    },
    [setValue]
  );

  const onValid = async (data: UpdateHabitInput) => {
    if (!session?.user?.id || !id || !habit) {
      return;
    }
    setSubmitting(true);
    const parsed = updateHabitSchema.safeParse(data);
    if (!parsed.success) {
      setSubmitting(false);
      Alert.alert("Check fields", parsed.error.issues[0]?.message ?? "Invalid data");
      return;
    }
    const { data: updated, error } = await updateHabit(session.user.id, id, parsed.data);
    setSubmitting(false);
    if (error || !updated) {
      Alert.alert("Could not save", error?.message ?? "Unknown error");
      return;
    }
    // Pop edit so the existing Details screen (below) is shown; `replace` can duplicate the route.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(hrefHabitDetail(id));
    }
  };

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

  if (err || !habit) {
    return (
      <View style={styles.padded}>
        <Text style={styles.error}>{err ?? "Not found"}</Text>
        <Pressable onPress={() => void loadHabit()}>
          <Text style={styles.link}>Try again</Text>
        </Pressable>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <RNView style={styles.flex}>
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
                placeholder="Habit name"
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

          <Text style={styles.label}>Start date</Text>
          <>
            {Platform.OS === "android" && (
              <Pressable
                onPress={() => setShowDatePicker(true)}
                style={({ pressed }) => [styles.dateBtn, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={styles.dateBtnText} lightColor="#000" darkColor="#fff">
                  {toISODateString(startDate)}
                </Text>
              </Pressable>
            )}
            {Platform.OS === "ios" && (
              <RNView
                onLayout={() => {
                  setContentVisible(true);
                }}
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

          <Pressable
            onPress={handleSubmit(onValid)}
            disabled={submitting}
            style={({ pressed }) => [
              styles.save,
              {
                backgroundColor: accent.primary,
                opacity: pressed || submitting ? 0.7 : 1,
              },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text lightColor="#fff" darkColor="#0f172a" style={styles.saveText}>
                Save changes
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
      {Platform.OS === "ios" && !contentVisible && (
        <RNView style={[StyleSheet.absoluteFill, styles.iosFormOverlay]}>
          <View style={styles.centered} lightColor="rgba(255,255,255,0.9)" darkColor="rgba(0,0,0,0.85)">
            <ActivityIndicator size="large" />
          </View>
        </RNView>
      )}
    </RNView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  padded: { flex: 1, padding: 20 },
  error: { color: "#b91c1c", marginBottom: 12 },
  link: { color: "#2f95dc", fontSize: 16, fontWeight: "500", marginBottom: 8 },
  content: { padding: 20, paddingBottom: 40, maxWidth: 480, width: "100%", alignSelf: "center" },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  dateBtn: { paddingVertical: 10, paddingHorizontal: 4, marginBottom: 4 },
  dateBtnText: { fontSize: 16, fontWeight: "500" },
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
  iosFormOverlay: { zIndex: 1, elevation: 1 },
});
