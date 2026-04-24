import { href } from "@/lib/href";
import { supabase } from "@/lib/supabase";
import { signupSchema, type SignupInput } from "@/lib/validation/auth";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text as RNText,
  TextInput,
  View as RNView,
} from "react-native";

import Colors from "@/constants/Colors";
import { PasswordTextInput } from "@/components/PasswordTextInput";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";

export default function SignupScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const theme = Colors[colorScheme];
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const { control, handleSubmit } = useForm<SignupInput>({
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (data) => {
    const parsed = signupSchema.safeParse(data);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Check your input";
      Alert.alert("Invalid input", msg);
      return;
    }
    setSubmitting(true);
    const { data: signData, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setSubmitting(false);
    if (error) {
      Alert.alert("Sign up failed", error.message);
      return;
    }
    if (signData.session) {
      router.replace(href.appHome);
      return;
    }
    Alert.alert(
      "Confirm your email",
      "We sent a confirmation link. Open it, then return here to sign in.",
      [{ text: "OK", onPress: () => router.replace(href.authLogin) }]
    );
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.flex}
    >
      <View style={styles.container}>
        <Text style={styles.heading}>Create account</Text>

        <Text style={styles.label}>Email</Text>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              placeholder="you@example.com"
              placeholderTextColor={theme.tabIconDefault}
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.tabIconDefault },
              ]}
            />
          )}
        />

        <Text style={styles.label}>Password</Text>
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <PasswordTextInput
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              textContentType="newPassword"
              autoComplete="password-new"
              placeholder="********"
              placeholderTextColor={theme.tabIconDefault}
              style={[
                styles.input,
                styles.inputAfterPassword,
                { color: theme.text, borderColor: theme.tabIconDefault },
              ]}
            />
          )}
        />
        <Text style={styles.passwordHint} lightColor="#666" darkColor="#aaa">
          {
            "Password must be at least 8 characters and include uppercase, lowercase, a number, and a symbol."
          }
        </Text>

        <Pressable
          onPress={onSubmit}
          disabled={submitting}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.tint, opacity: pressed || submitting ? 0.7 : 1 },
          ]}
        >
          {submitting ? (
            <ActivityIndicator color={colorScheme === "dark" ? "#000" : "#fff"} />
          ) : (
            <Text style={styles.buttonText} lightColor="#fff" darkColor="#000">
              Sign up
            </Text>
          )}
        </Pressable>

        <RNView style={styles.footerRow}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href={href.authLogin} asChild>
            <Pressable>
              <RNText style={{ color: theme.tint, fontSize: 16 }}>Sign in</RNText>
            </Pressable>
          </Link>
        </RNView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, padding: 24, justifyContent: "center" },
  heading: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 24,
    textAlign: "center",
    alignSelf: "stretch",
  },
  passwordHint: { fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: "500", marginBottom: 6 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
  },
  inputAfterPassword: { marginBottom: 0 },
  button: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { fontSize: 16, fontWeight: "600" },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    flexWrap: "wrap",
  },
  footerText: { fontSize: 16 },
});
