import { useAppColorScheme, useThemePreference } from "@/contexts/ThemePreferenceContext";

export { useThemePreference };

/**
 * On web, match native: honor Profile → Appearance.
 */
export function useColorScheme() {
  return useAppColorScheme();
}
