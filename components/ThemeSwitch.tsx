"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const THEME_CHANGE_EVENT = "zuam-theme-change";

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
}

export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>("light");
  const isDark = theme === "dark";

  useEffect(() => {
    const syncTheme = (nextTheme: Theme) => {
      setTheme(nextTheme);
      applyTheme(nextTheme);
    };

    syncTheme("light");

    const handleThemeChange = (event: Event) => {
      const nextTheme = (event as CustomEvent<{ theme?: Theme }>).detail?.theme;

      if (nextTheme === "light" || nextTheme === "dark") {
        syncTheme(nextTheme);
      }
    };

    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);

    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    };
  }, []);

  const toggleTheme = () => {
    const nextTheme = isDark ? "light" : "dark";

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
