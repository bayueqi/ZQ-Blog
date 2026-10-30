import { ScriptOnce } from "@tanstack/react-router";
import { createClientOnlyFn, createIsomorphicFn } from "@tanstack/react-start";
import type { ReactNode } from "react";
import { createContext, use, useEffect, useState } from "react";
import { z } from "zod";

const UserThemeSchema = z.enum(["light", "dark", "system"]).catch("system");
const _AppThemeSchema = z.enum(["light", "dark"]).catch("light");

export type UserTheme = z.infer<typeof UserThemeSchema>;
/** The theme actually shown: a "system" preference resolved to light or dark. */
export type AppTheme = z.infer<typeof _AppThemeSchema>;

const themeStorageKey = "ui-theme";

const getStoredUserTheme = createIsomorphicFn()
  .server((): UserTheme => "system")
  .client((): UserTheme => {
    const stored = localStorage.getItem(themeStorageKey);
    return UserThemeSchema.parse(stored);
  });

const setStoredTheme = createClientOnlyFn((theme: UserTheme) => {
  const validatedTheme = UserThemeSchema.parse(theme);
  localStorage.setItem(themeStorageKey, validatedTheme);
});

const getSystemTheme = createIsomorphicFn()
  .server((): AppTheme => "light")
  .client((): AppTheme => {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

const handleThemeChange = createClientOnlyFn(
  (userTheme: UserTheme, systemTheme: AppTheme) => {
    const validatedTheme = UserThemeSchema.parse(userTheme);

    const root = document.documentElement;
    root.classList.remove("light", "dark", "system");

    if (validatedTheme === "system") {
      root.classList.add(systemTheme, "system");
    } else {
      root.classList.add(validatedTheme);
    }
  },
);

const setupPreferredListener = createClientOnlyFn(
  (onChange: (systemTheme: AppTheme) => void) => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => onChange(mediaQuery.matches ? "dark" : "light");
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  },
);

const themeScript = (() => {
  function themeFn() {
    try {
      const storedTheme = localStorage.getItem("ui-theme") || "system";
      const validTheme = ["light", "dark", "system"].includes(storedTheme)
        ? storedTheme
        : "system";

      if (validTheme === "system") {
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
          .matches
          ? "dark"
          : "light";
        document.documentElement.classList.add(systemTheme, "system");
      } else {
        document.documentElement.classList.add(validTheme);
      }
    } catch {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      document.documentElement.classList.add(systemTheme, "system");
    }
  }
  return `(${themeFn.toString()})();`;
})();

interface ThemeContextProps {
  userTheme: UserTheme;
  appTheme: AppTheme;
  setTheme: (theme: UserTheme) => void;
}
const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}
export function ThemeProvider({ children }: ThemeProviderProps) {
  const [userTheme, setUserTheme] = useState<UserTheme>(getStoredUserTheme);
  const [systemTheme, setSystemTheme] = useState<AppTheme>(getSystemTheme);

  useEffect(() => {
    if (userTheme !== "system") return;
    return setupPreferredListener((nextSystemTheme) => {
      setSystemTheme(nextSystemTheme);
      handleThemeChange("system", nextSystemTheme);
    });
  }, [userTheme]);

  const appTheme = userTheme === "system" ? systemTheme : userTheme;

  const setTheme = (newUserTheme: UserTheme) => {
    const validatedTheme = UserThemeSchema.parse(newUserTheme);
    // The OS scheme is only watched while the theme is "system"; re-read it.
    const currentSystemTheme = getSystemTheme();
    setUserTheme(validatedTheme);
    setSystemTheme(currentSystemTheme);
    setStoredTheme(validatedTheme);
    handleThemeChange(validatedTheme, currentSystemTheme);
  };

  return (
    <ThemeContext value={{ userTheme, appTheme, setTheme }}>
      <ScriptOnce>{themeScript}</ScriptOnce>

      {children}
    </ThemeContext>
  );
}

export function useTheme() {
  const context = use(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
