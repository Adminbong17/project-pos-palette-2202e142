import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "qweek-theme";

export type Theme = "light" | "dark";

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    let initial: Theme = "light";
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (stored === "dark" || stored === "light") initial = stored;
      else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) initial = "dark";
    } catch {
      /* ignore */
    }
    setTheme(initial);
    apply(initial);
  }, []);

  const set = useCallback((next: Theme) => {
    setTheme(next);
    apply(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => set(theme === "dark" ? "light" : "dark"), [set, theme]);

  return { theme, setTheme: set, toggle };
}
