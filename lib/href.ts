import type { Href } from "expo-router";

/**
 * Central route hrefs. With `experiments.typedRoutes`, these literals are checked
 * against `.expo/types/router.d.ts` (regenerated when you run `npx expo start`).
 */
export const href: {
  readonly appHome: Href;
  readonly authLogin: Href;
  readonly authSignup: Href;
} = {
  appHome: "/(app)/(tabs)/today",
  authLogin: "/(auth)/login",
  authSignup: "/(auth)/signup",
};
