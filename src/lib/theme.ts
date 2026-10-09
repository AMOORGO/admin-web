"use client";

export type Theme = "light" | "dark";

const KEY = "amoorgo-theme";
const listeners = new Set<() => void>();

export function getTheme(): Theme {
  try {
    return window.localStorage.getItem(KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** Mirrors the theme onto <html> (data-theme + .dark), which the Tailwind dark variant keys off. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.classList.toggle("dark", theme === "dark");
  // Keep the browser chrome (mobile address bar) in step with the in-app theme, not just the OS preference.
  const color = theme === "dark" ? "#0F0811" : "#FDFBFC";
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", color));
}

export function setTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(KEY, theme);
  } catch {
    /* preference simply is not persisted */
  }
  applyTheme(theme);
  listeners.forEach((l) => l());
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
