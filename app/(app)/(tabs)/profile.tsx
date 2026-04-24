import { DestructiveOutlineButton } from "@/components/DestructiveOutlineButton";
import { PasswordTextInput } from "@/components/PasswordTextInput";
import { ShellTopAccent } from "@/components/shell/TabEmptyState";
import { Text, View } from "@/components/Themed";
import { useAuth } from "@/contexts/AuthContext";
import { useColorScheme } from "@/components/useColorScheme";
import { useThemePreference, type ThemePreference } from "@/contexts/ThemePreferenceContext";
import Colors from "@/constants/Colors";
import { supabase } from "@/lib/supabase";
import { productTheme } from "@/constants/theme";
import { changePasswordFormSchema, passwordField } from "@/lib/validation/auth";
import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View as RNView,
} from "react-native";

const p = productTheme.profile;

const appearanceOptions: { value: ThemePreference; label: string; hint: string }[] = [
  { value: "system", label: "System default", hint: "Match light or dark to your device" },
  { value: "light", label: "Light", hint: "Always use light mode" },
  { value: "dark", label: "Dark", hint: "Always use dark mode" },
];

function AppearanceOption({
  value,
  label,
  hint,
  selected,
  onSelect,
}: {
  value: ThemePreference;
  label: string;
  hint: string;
  selected: boolean;
  onSelect: (v: ThemePreference) => void;
}) {
  return (
    <Pressable
      onPress={() => onSelect(value)}
      style={({ pressed }) => [styles.appearanceRow, { opacity: pressed ? 0.75 : 1 }]}
    >
      <RNView style={styles.appearanceTextBox}>
        <Text
          style={styles.appearanceLabel}
          lightColor={Colors.light.text}
          darkColor={Colors.dark.text}
        >
          {label}
        </Text>
        <Text
          style={styles.appearanceHint}
          lightColor="#52525b"
          darkColor="rgba(255, 255, 255, 0.7)"
        >
          {hint}
        </Text>
      </RNView>
      {selected && (
        <Text style={styles.check} lightColor={p.primary} darkColor={Colors.dark.text}>
          ✓
        </Text>
      )}
    </Pressable>
  );
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

const PWD_INPUT_BORDER_ERR = "#ef4444";
const PWD_INPUT_BORDER_OK = "#22c55e";

/** Border / hint for change-password fields after blur, matching signup `password` rules. */
function getChangePasswordFieldStyles(
  newPassword: string,
  confirmPassword: string,
  newBlurred: boolean,
  confirmBlurred: boolean,
  defaultBorder: string
): {
  newBorder: string;
  confirmBorder: string;
  matchHint: { ok: boolean; text: string } | null;
} {
  const newOk = newPassword
    ? passwordField.safeParse(newPassword).success
    : false;

  let newBorder = defaultBorder;
  if (newBlurred) {
    if (!newPassword) {
      newBorder = PWD_INPUT_BORDER_ERR;
    } else if (!newOk) {
      newBorder = PWD_INPUT_BORDER_ERR;
    } else {
      newBorder = PWD_INPUT_BORDER_OK;
    }
  }

  let confirmBorder = defaultBorder;
  if (confirmBlurred) {
    if (!newOk) {
      confirmBorder = defaultBorder;
    } else if (confirmPassword.length === 0) {
      confirmBorder = PWD_INPUT_BORDER_ERR;
    } else if (newPassword !== confirmPassword) {
      confirmBorder = PWD_INPUT_BORDER_ERR;
    } else {
      confirmBorder = PWD_INPUT_BORDER_OK;
    }
  }

  let matchHint: { ok: boolean; text: string } | null = null;
  if (newBlurred && confirmBlurred && newOk) {
    if (newPassword && confirmPassword) {
      if (newPassword === confirmPassword) {
        matchHint = { ok: true, text: "Passwords match" };
      } else {
        matchHint = { ok: false, text: "Passwords do not match" };
      }
    } else if (confirmBlurred && !confirmPassword) {
      matchHint = { ok: false, text: "Confirm your new password" };
    }
  }

  return { newBorder, confirmBorder, matchHint };
}

/** Profile: account, theme, subscription (Phase 14). */
export default function ProfileScreen() {
  const { session, signOut, revalidateSession } = useAuth();
  const { preference, setPreference } = useThemePreference();
  const appScheme = useColorScheme() ?? "light";
  const authUser = session?.user;
  /** Pending change uses `new_email`; confirmed address stays in `email` until then. */
  const displayEmail = useMemo(
    () => authUser?.new_email?.trim() || authUser?.email || "Signed in",
    [authUser?.email, authUser?.new_email]
  );
  const hasPendingEmailChange = Boolean(authUser?.new_email);
  const [changeEmailOpen, setChangeEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [changeEmailError, setChangeEmailError] = useState<string | null>(null);
  const [changeEmailLoading, setChangeEmailLoading] = useState(false);

  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newPasswordBlurred, setNewPasswordBlurred] = useState(false);
  const [confirmPasswordBlurred, setConfirmPasswordBlurred] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  /** Remount password inputs on open (Android uncontrolled `PasswordTextInput`); clears native text. */
  const [changePasswordFieldMount, setChangePasswordFieldMount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void revalidateSession();
    }, [revalidateSession])
  );

  const openChangeEmail = useCallback(() => {
    const u = session?.user;
    setNewEmail((u?.new_email ?? u?.email ?? "").trim());
    setChangeEmailError(null);
    setChangeEmailOpen(true);
  }, [session?.user]);

  const closeChangeEmail = useCallback(() => {
    if (changeEmailLoading) return;
    setChangeEmailOpen(false);
    setChangeEmailError(null);
  }, [changeEmailLoading]);

  const submitChangeEmail = useCallback(async () => {
    const next = newEmail.trim();
    if (!isValidEmail(next)) {
      setChangeEmailError("Enter a valid email address.");
      return;
    }
    const u = session?.user;
    const currentTarget = (u?.new_email ?? u?.email ?? "").trim();
    if (next.toLowerCase() === currentTarget.toLowerCase()) {
      setChangeEmailOpen(false);
      return;
    }
    setChangeEmailError(null);
    setChangeEmailLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: next });
      if (error) {
        setChangeEmailError(error.message);
        return;
      }
      await supabase.auth.refreshSession().catch(() => {
        // Session often updates from `updateUser` already; refresh updates the token.
      });
      await revalidateSession();
      setChangeEmailOpen(false);
      Alert.alert(
        "Confirm your email",
        "We sent a link to the new address. Open it to finish updating your email. You may need to check your current inbox too, depending on your account settings."
      );
    } finally {
      setChangeEmailLoading(false);
    }
  }, [newEmail, revalidateSession, session?.user]);

  const openChangePassword = useCallback(() => {
    setNewPassword("");
    setConfirmPassword("");
    setNewPasswordBlurred(false);
    setConfirmPasswordBlurred(false);
    setChangePasswordError(null);
    setChangePasswordFieldMount((n) => n + 1);
    setChangePasswordOpen(true);
  }, []);

  const closeChangePassword = useCallback(() => {
    if (changePasswordLoading) return;
    setChangePasswordOpen(false);
    setChangePasswordError(null);
    setNewPassword("");
    setConfirmPassword("");
    setNewPasswordBlurred(false);
    setConfirmPasswordBlurred(false);
  }, [changePasswordLoading]);

  const passwordModalBorders = useMemo(
    () =>
      getChangePasswordFieldStyles(
        newPassword,
        confirmPassword,
        newPasswordBlurred,
        confirmPasswordBlurred,
        p.border
      ),
    [newPassword, confirmPassword, newPasswordBlurred, confirmPasswordBlurred]
  );

  const newPasswordRuleMessage = useMemo(() => {
    if (!newPasswordBlurred) return null;
    const r = passwordField.safeParse(newPassword);
    if (r.success) return null;
    return r.error.issues[0]?.message ?? null;
  }, [newPassword, newPasswordBlurred]);

  const submitChangePassword = useCallback(async () => {
    const parsed = changePasswordFormSchema.safeParse({ password: newPassword, confirmPassword });
    if (!parsed.success) {
      setChangePasswordError(parsed.error.issues[0]?.message ?? "Check your input");
      return;
    }
    setChangePasswordError(null);
    setChangePasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
      if (error) {
        setChangePasswordError(error.message);
        return;
      }
      await supabase.auth.refreshSession().catch(() => undefined);
      await revalidateSession();
      setChangePasswordOpen(false);
      setNewPassword("");
      setConfirmPassword("");
      setNewPasswordBlurred(false);
      setConfirmPasswordBlurred(false);
      Alert.alert("Password updated", "Your new password is saved. Use it the next time you sign in on another device.");
    } finally {
      setChangePasswordLoading(false);
    }
  }, [confirmPassword, newPassword, revalidateSession]);

  return (
    <RNView style={styles.screenRoot}>
      {/** Pinned under the tab header; not inside ScrollView so it does not scroll */}
      <ShellTopAccent variant="profile" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.inner} lightColor="transparent" darkColor="transparent">
        <Text
          style={styles.sectionTitle}
          accessibilityRole="header"
          lightColor={Colors.light.text}
          darkColor={Colors.dark.text}
        >
          Email
        </Text>
        <View
          style={[styles.card, { borderColor: p.border }]}
          lightColor="#f4f4f5"
          darkColor="rgba(255,255,255,0.06)"
        >
          <RNView style={styles.emailRow}>
            <Text
              style={styles.emailInCard}
              numberOfLines={2}
              lightColor="#52525b"
              darkColor="#a1a1aa"
            >
              {displayEmail}
            </Text>
            {authUser != null && (
              <Pressable
                onPress={openChangeEmail}
                style={({ pressed }) => [styles.changeEmailButton, { opacity: pressed ? 0.6 : 1 }]}
                accessibilityLabel="Change email address"
                accessibilityRole="button"
              >
                <Text
                  style={styles.changeEmailLabel}
                  lightColor={p.primary}
                  darkColor={p.primary}
                >
                  Change
                </Text>
              </Pressable>
            )}
          </RNView>
          {hasPendingEmailChange && authUser?.email ? (
            <Text
              style={styles.emailPendingNote}
              lightColor="#52525b"
              darkColor="#a1a1aa"
            >
              {`Confirm the link we emailed you. You are still signed in as ${authUser.email} until you confirm.`}
            </Text>
          ) : null}
        </View>

        {authUser != null ? (
          <>
            <Text
              style={styles.sectionTitle}
              accessibilityRole="header"
              lightColor={Colors.light.text}
              darkColor={Colors.dark.text}
            >
              Password
            </Text>
            <Pressable
              onPress={openChangePassword}
              style={({ pressed }) => [
                styles.passwordChangeButton,
                appScheme === "dark" ? styles.passwordChangeButtonDark : styles.passwordChangeButtonLight,
                { opacity: pressed ? 0.88 : 1 },
              ]}
              accessibilityLabel="Change password"
              accessibilityRole="button"
            >
              <Text
                style={styles.passwordChangeButtonLabel}
                lightColor={p.strong}
                darkColor="#d1d5db"
              >
                Change password
              </Text>
            </Pressable>
          </>
        ) : null}

        <Modal
          visible={changeEmailOpen}
          animationType="fade"
          transparent
          onRequestClose={closeChangeEmail}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.emailModalKav}
          >
            <RNView style={styles.emailModalRoot}>
              <Pressable
                style={[StyleSheet.absoluteFill, styles.emailModalBackdrop]}
                onPress={closeChangeEmail}
                accessibilityRole="button"
                accessibilityLabel="Dismiss"
              />
              <View
                style={[styles.emailModalCard, { borderColor: p.border }]}
                lightColor="#f9fafb"
                darkColor="#1c1c1e"
              >
                <Text
                  style={styles.emailModalTitle}
                  lightColor={Colors.light.text}
                  darkColor={Colors.dark.text}
                >
                  Change email
                </Text>
                <Text
                  style={styles.emailModalHint}
                  lightColor="#52525b"
                  darkColor="#a1a1aa"
                >
                  We will send a confirmation link. Your sign-in may use the new address only after
                  you confirm.
                </Text>
                <TextInput
                  value={newEmail}
                  onChangeText={(t) => {
                    setNewEmail(t);
                    if (changeEmailError) setChangeEmailError(null);
                  }}
                  placeholder="name@example.com"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
                  editable={!changeEmailLoading}
                  style={[
                    styles.emailModalInput,
                    {
                      color: appScheme === "dark" ? Colors.dark.text : Colors.light.text,
                      borderColor: p.border,
                      backgroundColor: appScheme === "dark" ? "rgba(0,0,0,0.25)" : "#fff",
                    },
                  ]}
                />
                {changeEmailError != null && (
                  <Text style={styles.emailModalError} lightColor="#b91c1c" darkColor="#f87171">
                    {changeEmailError}
                  </Text>
                )}
                <RNView style={styles.emailModalActions}>
                  <Pressable
                    onPress={closeChangeEmail}
                    disabled={changeEmailLoading}
                    style={({ pressed }) => [
                      styles.emailModalCancel,
                      { opacity: pressed && !changeEmailLoading ? 0.65 : 1 },
                    ]}
                  >
                    <Text
                      style={styles.emailModalCancelText}
                      lightColor="#52525b"
                      darkColor="#a1a1aa"
                    >
                      Cancel
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      void submitChangeEmail();
                    }}
                    disabled={changeEmailLoading}
                    style={({ pressed }) => [
                      styles.emailModalSave,
                      {
                        backgroundColor: p.primary,
                        opacity: pressed && !changeEmailLoading ? 0.9 : 1,
                      },
                    ]}
                  >
                    {changeEmailLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.emailModalSaveText} lightColor="#fff" darkColor="#fff">
                        Save
                      </Text>
                    )}
                  </Pressable>
                </RNView>
              </View>
            </RNView>
          </KeyboardAvoidingView>
        </Modal>

        <Modal
          visible={changePasswordOpen}
          animationType="fade"
          transparent
          onRequestClose={closeChangePassword}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.emailModalKav}
          >
            <RNView style={styles.emailModalRoot}>
              <Pressable
                style={[StyleSheet.absoluteFill, styles.emailModalBackdrop]}
                onPress={closeChangePassword}
                accessibilityRole="button"
                accessibilityLabel="Dismiss"
              />
              <View
                style={[styles.emailModalCard, { borderColor: p.border }]}
                lightColor="#f9fafb"
                darkColor="#1c1c1e"
              >
                <Text
                  style={styles.emailModalTitle}
                  lightColor={Colors.light.text}
                  darkColor={Colors.dark.text}
                >
                  Change password
                </Text>
                <Text
                  style={styles.emailModalHint}
                  lightColor="#52525b"
                  darkColor="#a1a1aa"
                >
                  {
                    "Password must be at least 8 characters and include uppercase, lowercase, a number, and a symbol."
                  }
                </Text>
                <Text
                  style={styles.passwordModalLabel}
                  lightColor={Colors.light.text}
                  darkColor={Colors.dark.text}
                >
                  New password
                </Text>
                <PasswordTextInput
                  key={Platform.OS === "android" ? `pw-new-${changePasswordFieldMount}` : undefined}
                  value={newPassword}
                  onChangeText={(t) => {
                    setNewPassword(t);
                    if (changePasswordError) setChangePasswordError(null);
                  }}
                  onBlur={() => {
                    setNewPasswordBlurred(true);
                  }}
                  textContentType="newPassword"
                  autoComplete="password-new"
                  placeholder="New password"
                  placeholderTextColor="#9ca3af"
                  editable={!changePasswordLoading}
                  style={[
                    styles.emailModalInput,
                    {
                      color: appScheme === "dark" ? Colors.dark.text : Colors.light.text,
                      borderColor: passwordModalBorders.newBorder,
                      backgroundColor: appScheme === "dark" ? "rgba(0,0,0,0.25)" : "#fff",
                    },
                  ]}
                />
                {newPasswordRuleMessage != null && (
                  <Text style={styles.pwdFieldRuleText} lightColor="#b91c1c" darkColor="#f87171">
                    {newPasswordRuleMessage}
                  </Text>
                )}
                <Text
                  style={styles.passwordModalLabel}
                  lightColor={Colors.light.text}
                  darkColor={Colors.dark.text}
                >
                  Confirm new password
                </Text>
                <PasswordTextInput
                  key={Platform.OS === "android" ? `pw-confirm-${changePasswordFieldMount}` : undefined}
                  value={confirmPassword}
                  onChangeText={(t) => {
                    setConfirmPassword(t);
                    if (changePasswordError) setChangePasswordError(null);
                  }}
                  onBlur={() => {
                    setConfirmPasswordBlurred(true);
                  }}
                  textContentType="newPassword"
                  autoComplete="password-new"
                  placeholder="Re-enter your new password"
                  placeholderTextColor="#9ca3af"
                  editable={!changePasswordLoading}
                  style={[
                    styles.emailModalInput,
                    {
                      color: appScheme === "dark" ? Colors.dark.text : Colors.light.text,
                      borderColor: passwordModalBorders.confirmBorder,
                      backgroundColor: appScheme === "dark" ? "rgba(0,0,0,0.25)" : "#fff",
                    },
                  ]}
                />
                {passwordModalBorders.matchHint != null && (
                  <Text
                    style={styles.pwdMatchHint}
                    lightColor={passwordModalBorders.matchHint.ok ? PWD_INPUT_BORDER_OK : PWD_INPUT_BORDER_ERR}
                    darkColor={passwordModalBorders.matchHint.ok ? PWD_INPUT_BORDER_OK : PWD_INPUT_BORDER_ERR}
                  >
                    {passwordModalBorders.matchHint.text}
                  </Text>
                )}
                {changePasswordError != null && (
                  <Text style={styles.emailModalError} lightColor="#b91c1c" darkColor="#f87171">
                    {changePasswordError}
                  </Text>
                )}
                <RNView style={styles.emailModalActions}>
                  <Pressable
                    onPress={closeChangePassword}
                    disabled={changePasswordLoading}
                    style={({ pressed }) => [
                      styles.emailModalCancel,
                      { opacity: pressed && !changePasswordLoading ? 0.65 : 1 },
                    ]}
                  >
                    <Text
                      style={styles.emailModalCancelText}
                      lightColor="#52525b"
                      darkColor="#a1a1aa"
                    >
                      Cancel
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      void submitChangePassword();
                    }}
                    disabled={changePasswordLoading}
                    style={({ pressed }) => [
                      styles.emailModalSave,
                      {
                        backgroundColor: p.primary,
                        opacity: pressed && !changePasswordLoading ? 0.9 : 1,
                      },
                    ]}
                  >
                    {changePasswordLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.emailModalSaveText} lightColor="#fff" darkColor="#fff">
                        Save
                      </Text>
                    )}
                  </Pressable>
                </RNView>
              </View>
            </RNView>
          </KeyboardAvoidingView>
        </Modal>

        <Text
          style={styles.sectionTitle}
          lightColor={Colors.light.text}
          darkColor={Colors.dark.text}
        >
          Subscription
        </Text>
        <View
          style={[styles.card, { borderColor: p.border }]}
          lightColor="#f4f4f5"
          darkColor="rgba(255,255,255,0.06)"
        >
          <Text
            style={styles.cardBody}
            lightColor="#52525b"
            darkColor="#a1a1aa"
          >
            Free tier and paywall will show here (RevenueCat in a later phase).
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: productTheme.today.primary, opacity: pressed ? 0.85 : 1 },
            ]}
            disabled
          >
            <Text style={styles.ctaText} lightColor="#fff" darkColor="#0f172a">
              View plans (soon)
            </Text>
          </Pressable>
        </View>

        <Text
          style={styles.sectionTitle}
          accessibilityRole="header"
          lightColor={Colors.light.text}
          darkColor={Colors.dark.text}
        >
          Appearance
        </Text>
        <View
          style={[styles.appearanceCard, { borderColor: p.border }]}
          lightColor="#f9fafb"
          darkColor="rgba(255,255,255,0.06)"
        >
          {appearanceOptions.map((opt, i) => (
            <RNView
              key={opt.value}
              style={
                i < appearanceOptions.length - 1
                  ? [styles.appearanceDivider, { borderBottomColor: p.border }]
                  : undefined
              }
            >
              <AppearanceOption
                {...opt}
                selected={preference === opt.value}
                onSelect={setPreference}
              />
            </RNView>
          ))}
        </View>

        <DestructiveOutlineButton
          label="Sign out"
          onPress={() => {
            void signOut();
          }}
          style={styles.signOutButton}
        />
        </View>
      </ScrollView>
    </RNView>
  );
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  inner: {
    paddingHorizontal: 24,
    paddingTop: 32,
    maxWidth: 400,
    alignSelf: "center",
    width: "100%",
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  emailInCard: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 22 },
  changeEmailButton: { paddingVertical: 4, paddingHorizontal: 4 },
  changeEmailLabel: { fontSize: 15, fontWeight: "600" },
  /** Matches `DestructiveOutlineButton` shape (outlined, modest height), profile tint. */
  passwordChangeButton: {
    borderRadius: 10,
    borderWidth: 1.5,
    alignSelf: "stretch",
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  passwordChangeButtonLight: {
    backgroundColor: p.soft,
    borderColor: p.border,
  },
  passwordChangeButtonDark: {
    backgroundColor: "rgba(107, 114, 128, 0.24)",
    borderColor: "rgba(190, 200, 215, 0.42)",
  },
  passwordChangeButtonLabel: { fontSize: 16, fontWeight: "600" },
  emailPendingNote: { marginTop: 10, fontSize: 13, lineHeight: 18 },
  emailModalKav: { flex: 1 },
  emailModalRoot: { flex: 1, justifyContent: "center", padding: 24 },
  emailModalBackdrop: { backgroundColor: "rgba(0,0,0,0.45)" },
  emailModalCard: {
    zIndex: 1,
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
  },
  emailModalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emailModalHint: { fontSize: 14, lineHeight: 20, marginBottom: 14 },
  emailModalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 8,
  },
  emailModalError: { fontSize: 13, marginBottom: 8 },
  emailModalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  emailModalCancel: { paddingVertical: 10, paddingHorizontal: 12 },
  emailModalCancelText: { fontSize: 16, fontWeight: "600" },
  emailModalSave: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 88,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  emailModalSaveText: { fontSize: 16, fontWeight: "600" },
  passwordModalLabel: { fontSize: 14, fontWeight: "500", marginBottom: 6, marginTop: 4 },
  pwdFieldRuleText: { fontSize: 12, marginBottom: 6, marginTop: -2 },
  pwdMatchHint: { fontSize: 13, fontWeight: "600", marginTop: 2, marginBottom: 4 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  appearanceCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 24,
  },
  appearanceDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  appearanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  appearanceTextBox: { flex: 1, marginRight: 8 },
  appearanceLabel: { fontSize: 16, fontWeight: "500" },
  appearanceHint: { fontSize: 12, marginTop: 2 },
  check: { fontSize: 18, fontWeight: "700" },
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 20,
  },
  cardBody: { fontSize: 15, lineHeight: 22, marginBottom: 14 },
  cta: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  ctaText: { fontSize: 16, fontWeight: "600" },
  signOutButton: { marginTop: 4 },
});
