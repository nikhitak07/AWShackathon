export type Theme = "dark" | "light";

export interface ThemeTokens {
  // backgrounds
  pageBg: string;
  navBg: string;
  cardBg: string;
  inputBg: string;
  fieldGroupBg: string;
  sectionBg: string;
  // borders
  border: string;
  fieldDivider: string;
  itemDivider: string;
  // text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInput: string;
  // interactive
  btnSecondaryBg: string;
  btnSecondaryColor: string;
  // misc
  orb1: string;
  orb2: string;
  gridLine: string;
  progressTrack: string;
  spinnerTrack: string;
  orLine: string;
  // chat
  aiBubbleBg: string;
  aiBubbleColor: string;
  chatInputBg: string;
  chatInputBorder: string;
  chatHeaderBg: string;
  suggestionBg: string;
}

export const dark: ThemeTokens = {
  pageBg: "#08080f",
  navBg: "rgba(8,8,15,0.85)",
  cardBg: "rgba(255,255,255,0.05)",
  inputBg: "transparent",
  fieldGroupBg: "rgba(255,255,255,0.07)",
  sectionBg: "rgba(255,255,255,0.05)",
  border: "rgba(255,255,255,0.1)",
  fieldDivider: "rgba(255,255,255,0.08)",
  itemDivider: "rgba(255,255,255,0.06)",
  textPrimary: "#ffffff",
  textSecondary: "#ebebf5",
  textMuted: "#636366",
  textInput: "#ffffff",
  btnSecondaryBg: "rgba(255,255,255,0.06)",
  btnSecondaryColor: "#007AFF",
  orb1: "radial-gradient(circle, rgba(0,122,255,0.18) 0%, transparent 65%)",
  orb2: "radial-gradient(circle, rgba(88,86,214,0.15) 0%, transparent 65%)",
  gridLine: "rgba(255,255,255,0.03)",
  progressTrack: "rgba(255,255,255,0.1)",
  spinnerTrack: "rgba(255,255,255,0.1)",
  orLine: "rgba(255,255,255,0.08)",
  aiBubbleBg: "rgba(255,255,255,0.08)",
  aiBubbleColor: "#ebebf5",
  chatInputBg: "rgba(255,255,255,0.07)",
  chatInputBorder: "rgba(255,255,255,0.1)",
  chatHeaderBg: "rgba(255,255,255,0.04)",
  suggestionBg: "rgba(255,255,255,0.07)",
};

export const light: ThemeTokens = {
  pageBg: "#f2f2f7",
  navBg: "rgba(255,255,255,0.8)",
  cardBg: "rgba(255,255,255,0.85)",
  inputBg: "transparent",
  fieldGroupBg: "#f2f2f7",
  sectionBg: "rgba(255,255,255,0.85)",
  border: "rgba(0,0,0,0.06)",
  fieldDivider: "rgba(0,0,0,0.08)",
  itemDivider: "#f2f2f7",
  textPrimary: "#1c1c1e",
  textSecondary: "#2c2c2e",
  textMuted: "#8e8e93",
  textInput: "#1c1c1e",
  btnSecondaryBg: "#f2f2f7",
  btnSecondaryColor: "#007AFF",
  orb1: "radial-gradient(circle, rgba(0,122,255,0.10) 0%, transparent 65%)",
  orb2: "radial-gradient(circle, rgba(88,86,214,0.08) 0%, transparent 65%)",
  gridLine: "rgba(0,0,0,0.025)",
  progressTrack: "#e5e5ea",
  spinnerTrack: "#e5e5ea",
  orLine: "#e5e5ea",
  aiBubbleBg: "#f2f2f7",
  aiBubbleColor: "#1c1c1e",
  chatInputBg: "#f2f2f7",
  chatInputBorder: "#e5e5ea",
  chatHeaderBg: "rgba(255,255,255,0.6)",
  suggestionBg: "#f2f2f7",
};
