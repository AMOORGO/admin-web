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
