// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { m } from "@/paraglide/messages";
import { ErrorPage } from "./error-page";

const router = vi.hoisted(() => ({
  invalidate: vi.fn(),
  pathname: "/",
  state: { matches: [] as Array<{ status: string }> },
}));

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => router,
  useLocation: ({
    select,
  }: {
    select: (location: { pathname: string }) => unknown;
  }) => select({ pathname: router.pathname }),
  Link: ({
    to,
    children,
    className,
  }: {
    to: string;
    children: ReactNode;
    className?: string;
  }) => createElement("a", { href: to, className }, children),
}));

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  router.invalidate.mockReset();
  router.state.matches = [];
  router.pathname = "/";
});
afterEach(cleanup);

it("disables retry while loading and resets the boundary only after invalidation finishes", async () => {
  const pending = deferred();
  router.invalidate.mockReturnValue(pending.promise);
  const reset = vi.fn();
  const rawError = "Internal database connection credentials";
  render(createElement(ErrorPage, { reset, error: new Error(rawError) }));
  expect(screen.queryByText(rawError, { exact: false })).toBeNull();
  const button = screen.getByRole("button", {
    name: m.error_retry(),
  }) as HTMLButtonElement;

  fireEvent.click(button);
  expect(button.disabled).toBe(true);
  expect(button.getAttribute("aria-busy")).toBe("true");
  expect(button.textContent).toBe(m.error_retrying());
  expect(router.invalidate).toHaveBeenCalledWith({ sync: true });
  expect(reset).not.toHaveBeenCalled();
  fireEvent.click(button);
  expect(router.invalidate).toHaveBeenCalledOnce();

  await act(async () => pending.resolve());
  expect(reset).toHaveBeenCalledOnce();
  expect(button.disabled).toBe(false);
  expect(button.getAttribute("aria-busy")).toBeNull();
  expect(screen.queryByRole("status")).toBeNull();
});

it("shows safe feedback after rejection and allows another retry", async () => {
  const pending = deferred();
  router.invalidate.mockReturnValueOnce(pending.promise);
  const reset = vi.fn();
  render(createElement(ErrorPage, { reset }));
  const button = screen.getByRole("button", {
    name: m.error_retry(),
  }) as HTMLButtonElement;

  fireEvent.click(button);
  const rawError = "Sensitive internal response details";
  await act(async () => pending.reject(new Error(rawError)));
  expect(reset).not.toHaveBeenCalled();
  expect(button.disabled).toBe(false);
  expect(button.getAttribute("aria-busy")).toBeNull();
  expect(screen.getByRole("status").textContent).toBe(m.error_retry_failed());
  expect(screen.queryByText(rawError, { exact: false })).toBeNull();

  router.invalidate.mockResolvedValueOnce(undefined);
  await act(async () => fireEvent.click(button));
  expect(router.invalidate).toHaveBeenCalledTimes(2);
  expect(reset).toHaveBeenCalledOnce();
  expect(screen.queryByRole("status")).toBeNull();
});

it("reports a route that remains failed even when invalidation resolves", async () => {
  router.invalidate.mockResolvedValueOnce(undefined);
  router.state.matches = [{ status: "error" }];
  render(createElement(ErrorPage));
  const button = screen.getByRole("button", {
    name: m.error_retry(),
  }) as HTMLButtonElement;

  await act(async () => fireEvent.click(button));
  expect(button.disabled).toBe(false);
  expect(screen.getByRole("status").textContent).toBe(m.error_retry_failed());
});

it("keeps admin recovery inside the admin workspace", () => {
  router.pathname = "/admin/media";
  render(createElement(ErrorPage));
  expect(
    screen
      .getByRole("link", { name: m.error_back_dashboard() })
      .getAttribute("href"),
  ).toBe("/admin");
  expect(screen.queryByRole("link", { name: m.not_found_return() })).toBeNull();
});
