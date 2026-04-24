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

export function hrefHabitNew(type: "build" | "break"): Href {
  return `/(app)/habit/new?type=${type}` as Href;
}

export function hrefHabitDetail(id: string): Href {
  return `/(app)/habit/${id}` as Href;
}

export function hrefHabitEdit(id: string): Href {
  return `/(app)/habit/edit/${id}` as Href;
}

export function hrefHabitListForType(type: "build" | "break"): Href {
  return type === "break" ? "/(app)/(tabs)/break" : "/(app)/(tabs)/build";
}
