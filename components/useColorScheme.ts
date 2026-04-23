import { useThemePreference, useAppColorScheme } from "@/contexts/ThemePreferenceContext";

/** Use `useThemePreference` when you need light/dark/system. */
export { useThemePreference };

/**
 * App color scheme: light or dark, honoring Profile → Appearance.
 * (Name matches RN’s hook for drop-in use with Themed and navigation.)
 */
export function useColorScheme() {
  return useAppColorScheme();
}
