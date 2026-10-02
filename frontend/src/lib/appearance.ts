import type { AppSettings } from "./api";

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  accent: "neutral",
  compact: false,
  sidebar_width: "normal",
  custom_templates_dir: "",
};

// Cached copy so the next load paints with the right theme before the API answers.
const CACHE_KEY = "scaffold-forge-appearance";

export const SIDEBAR_CLASS: Record<AppSettings["sidebar_width"], string> = {
  narrow: "w-56",
  normal: "w-64",
  wide: "w-80",
};

export function applyAppearance(settings: AppSettings) {
  const root = document.documentElement;
  const dark =
    settings.theme === "dark" ||
    (settings.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  root.dataset.accent = settings.accent;
  root.dataset.compact = String(settings.compact);
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(settings));
  } catch {
    // storage unavailable
  }
}

export function cachedAppearance(): AppSettings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Inline script for <head>: applies the cached theme before first paint. */
export const APPEARANCE_BOOT_SCRIPT = `try{var s=JSON.parse(localStorage.getItem("${CACHE_KEY}")||"{}");var r=document.documentElement;var d=s.theme==="light"?false:s.theme==="system"?matchMedia("(prefers-color-scheme: dark)").matches:true;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";if(s.accent)r.dataset.accent=s.accent;if(s.compact)r.dataset.compact="true";}catch(e){}`;
