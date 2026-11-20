export const THEMES = {
  dark: { label: "Oscuro", background: "#0d1311", foreground: "#e6eee9" },
  light: { label: "Claro", background: "#f2f4f0", foreground: "#12201a" },
} as const;

export type ThemeMode = keyof typeof THEMES;

export const DEFAULT_THEME: ThemeMode = "dark";
export const THEME_STORAGE_KEY = "ech:theme";
export const THEME_MODES = Object.keys(THEMES) as ThemeMode[];

export function readTheme(value: string | null | undefined): ThemeMode {
  return value && Object.hasOwn(THEMES, value) ? (value as ThemeMode) : DEFAULT_THEME;
}

// La preferencia se aplica antes de que el navegador pinte el contenido.
export const themeBootScript = `try {
  const mode = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
  if (${JSON.stringify(THEME_MODES)}.includes(mode)) {
    document.documentElement.dataset.theme = mode;
  }
} catch {}`;
