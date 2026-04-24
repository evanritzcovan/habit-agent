/**
 * Product shell tokens. Pastel accents: Today (blue), Build (green), Break (pink),
 * Track (yellow), Profile (gray).
 */
export const productTheme = {
  today: {
    primary: "#5b8fd8",
    strong: "#3b6cb5",
    soft: "rgba(91, 143, 216, 0.14)",
    border: "rgba(91, 143, 216, 0.38)",
  },
  build: {
    primary: "#16a34a",
    strong: "#15803d",
    soft: "rgba(22, 163, 74, 0.12)",
    border: "rgba(22, 163, 74, 0.35)",
  },
  break: {
    primary: "#db2777",
    strong: "#9d174d",
    soft: "rgba(219, 39, 119, 0.12)",
    border: "rgba(219, 39, 119, 0.35)",
  },
  track: {
    primary: "#c4a10d",
    strong: "#a16207",
    soft: "rgba(202, 161, 13, 0.16)",
    border: "rgba(202, 161, 13, 0.4)",
  },
  profile: {
    primary: "#6b7280",
    strong: "#4b5563",
    soft: "rgba(107, 114, 128, 0.14)",
    border: "rgba(107, 114, 128, 0.35)",
  },
} as const;

/**
 * Header bar under the nav (ShellTopAccent) — a bit more vivid than `productTheme.*.soft/border`
 * so the strip reads well in both light and dark mode.
 */
export const productThemeHeaderStrip: Record<
  "today" | "build" | "break" | "track" | "profile",
  { soft: string; border: string }
> = {
  today: {
    soft: "rgba(100, 160, 235, 0.30)",
    border: "rgba(130, 185, 255, 0.58)",
  },
  build: {
    soft: "rgba(50, 210, 110, 0.28)",
    border: "rgba(100, 230, 150, 0.55)",
  },
  break: {
    soft: "rgba(240, 90, 160, 0.28)",
    border: "rgba(255, 130, 195, 0.55)",
  },
  track: {
    soft: "rgba(230, 190, 50, 0.30)",
    border: "rgba(255, 220, 90, 0.55)",
  },
  profile: {
    soft: "rgba(150, 160, 180, 0.30)",
    border: "rgba(190, 200, 215, 0.55)",
  },
};

export type TabShellVariant = "today" | "build" | "break" | "track" | "profile" | "default";

export type ProductAccent = (typeof productTheme)[keyof typeof productTheme];

export function getTabAccent(variant: TabShellVariant): ProductAccent | null {
  if (variant === "default") return null;
  return productTheme[variant];
}
