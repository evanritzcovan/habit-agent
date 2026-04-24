import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Appearance, AppState, type AppStateStatus } from "react-native";

const STORAGE_KEY = "@habit_agent_theme_preference";

function systemSchemeFromAppearance(): "light" | "dark" {
  return Appearance.getColorScheme() === "dark" ? "dark" : "light";
}

export type ThemePreference = "light" | "dark" | "system";

type ThemePreferenceValue = {
  preference: ThemePreference;
  setPreference: (v: ThemePreference) => void;
  /** Resolved to light or dark (system follows device). */
  resolvedColorScheme: "light" | "dark";
};

const ThemePreferenceContext = createContext<ThemePreferenceValue | null>(null);

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  /** Subscribe to OS light/dark changes; `useColorScheme()` alone can miss updates until reload. */
  const [systemScheme, setSystemScheme] = useState<"light" | "dark">(systemSchemeFromAppearance);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme === "dark" ? "dark" : "light");
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const onAppState = (state: AppStateStatus) => {
      if (state === "active") {
        setSystemScheme(systemSchemeFromAppearance());
      }
    };
    const sub = AppState.addEventListener("change", onAppState);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (cancelled) return;
      if (raw === "light" || raw === "dark" || raw === "system") {
        setPreferenceState(raw);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const resolvedColorScheme: "light" | "dark" = useMemo(() => {
    if (preference === "light") return "light";
    if (preference === "dark") return "dark";
    return systemScheme === "dark" ? "dark" : "light";
  }, [preference, systemScheme]);

  /**
   * Keep React Native’s appearance in sync with Profile → Appearance so `useColorScheme`
   * and native status/navigation chrome (notably Android) follow the in-app mode instead of
   * only the device default.
   */
  useEffect(() => {
    if (preference === "system") {
      Appearance.setColorScheme(null);
    } else {
      Appearance.setColorScheme(resolvedColorScheme);
    }
  }, [preference, resolvedColorScheme]);

  const setPreference = useCallback((v: ThemePreference) => {
    setPreferenceState(v);
    void AsyncStorage.setItem(STORAGE_KEY, v);
  }, []);

  const value = useMemo(
    () => ({ preference, setPreference, resolvedColorScheme }),
    [preference, setPreference, resolvedColorScheme]
  );

  return (
    <ThemePreferenceContext.Provider value={value}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference() {
  const ctx = useContext(ThemePreferenceContext);
  if (!ctx) {
    throw new Error("useThemePreference must be used within ThemePreferenceProvider");
  }
  return ctx;
}

/**
 * Replaces the default from `react-native` so the rest of the app respects Profile → Appearance.
 */
export function useAppColorScheme(): "light" | "dark" {
  return useThemePreference().resolvedColorScheme;
}
