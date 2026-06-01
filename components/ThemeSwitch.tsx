"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "zuam-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";
const THEME_CHANGE_EVENT = "zuam-theme-change";

function getSystemTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedTheme = window.localStorage?.getItem(THEME_STORAGE_KEY);

    return storedTheme === "light" || storedTheme === "dark"
      ? storedTheme
      : null;
  } catch {
    return null;
  }
}

function storeTheme(theme: Theme) {
  try {
    window.localStorage?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    return;
  }
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  const storedTheme = getStoredTheme();

  return storedTheme || getSystemTheme();
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
}

export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>("light");
  const isDark = theme === "dark";

  useEffect(() => {
    const initialTheme = getInitialTheme();
    const mediaQuery = window.matchMedia(DARK_QUERY);
    const syncTheme = (nextTheme: Theme) => {
      setTheme(nextTheme);
      applyTheme(nextTheme);
    };

    syncTheme(initialTheme);

    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      const storedTheme = getStoredTheme();

      if (storedTheme) {
        return;
      }

      const nextTheme = event.matches ? "dark" : "light";
      syncTheme(nextTheme);
    };

    const handleThemeChange = (event: Event) => {
      const nextTheme = (event as CustomEvent<{ theme?: Theme }>).detail?.theme;

      if (nextTheme === "light" || nextTheme === "dark") {
        syncTheme(nextTheme);
      }
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) {
        syncTheme(getInitialTheme());
      }
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);
    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
      window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const toggleTheme = () => {
    const nextTheme = isDark ? "light" : "dark";

    storeTheme(nextTheme);
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.dispatchEvent(
      new CustomEvent(THEME_CHANGE_EVENT, { detail: { theme: nextTheme } })
    );
  };

  return (
    <button
      type="button"
      className="theme-switch"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      title={isDark ? "Light mode" : "Dark mode"}
      onClick={toggleTheme}
    >
      <span className="theme-switch-track" aria-hidden="true">
        <Sun className="theme-switch-icon theme-switch-icon-sun" size={14} />
        <Moon className="theme-switch-icon theme-switch-icon-moon" size={14} />
        <span className="theme-switch-thumb" />
      </span>
    </button>
  );
}
