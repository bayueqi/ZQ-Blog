// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "./theme-provider";

// The theme script only matters during SSR and needs a router.
vi.mock("@tanstack/react-router", () => ({ ScriptOnce: () => null }));

/** A stand-in for the OS `prefers-color-scheme: dark` query. */
function fakeColorScheme(initiallyDark: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    matches: initiallyDark,
    addEventListener: (_type: string, listener: () => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: () => void) => {
      listeners.delete(listener);
    },
  };
  window.matchMedia = vi.fn(() => query as unknown as MediaQueryList);
  return {
    change(dark: boolean) {
      query.matches = dark;
      for (const listener of listeners) listener();
    },
  };
}

function AppThemeProbe() {
  const { appTheme } = useTheme();
  return createElement("span", { "data-testid": "app-theme" }, appTheme);
}

function renderWithTheme() {
  render(createElement(ThemeProvider, null, createElement(AppThemeProbe)));
  return () => screen.getByTestId("app-theme").textContent;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
});

afterEach(cleanup);

it("follows an OS colour-scheme change while the theme is system", () => {
  const colorScheme = fakeColorScheme(false);
  const appTheme = renderWithTheme();
  expect(appTheme()).toBe("light");

  act(() => colorScheme.change(true));

  expect(appTheme()).toBe("dark");
  expect(document.documentElement.classList.contains("dark")).toBe(true);
});
