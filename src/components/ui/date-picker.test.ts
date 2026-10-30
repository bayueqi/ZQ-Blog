// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement, type FormEvent } from "react";
import { findInPopover } from "tests/popover";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import DatePicker from "./date-picker";

vi.mock("@/paraglide/runtime", async () => ({
  ...(await vi.importActual("@/paraglide/runtime")),
  getLocale: () => "en",
}));

const originalTZ = process.env.TZ;

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

it.each(["Pacific/Kiritimati", "Etc/GMT+12"])(
  "keeps the selected month and Sunday-first calendar correct in %s",
  async (timezone) => {
    process.env.TZ = timezone;
    render(
      createElement(DatePicker, {
        value: "2026-09-01",
        onChange: vi.fn(),
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "2026-09-01" }));
    expect((await findInPopover("heading")).textContent).toBe("September 2026");
    const calendars = document.querySelectorAll(".grid-cols-7");
    expect(Array.from(calendars[0].children, (day) => day.textContent)).toEqual(
      ["S", "M", "T", "W", "T", "F", "S"],
    );
    // September 1, 2026 is a Tuesday: Sunday and Monday are empty slots.
    expect(calendars[1].children[2].textContent).toBe("1");
  },
);

it("uses the supplied UTC today, disables future days, and keeps picks date-only", async () => {
  process.env.TZ = "Pacific/Kiritimati";
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-01T23:30:00Z"));
  const onChange = vi.fn();
  const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
  render(
    createElement(
      "form",
      { onSubmit },
      createElement(DatePicker, {
        value: "2026-09-01",
        today: "2026-09-01",
        maxDate: "2026-09-01",
        onChange,
      }),
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "2026-09-01" }));
  const today = await findInPopover("button", { name: "1" });
  expect(document.activeElement).toBe(today);
  expect(today.getAttribute("aria-current")).toBe("date");
  expect(today.getAttribute("aria-pressed")).toBe("true");
  const tomorrow = screen.getByRole("button", { name: "2" });
  expect((tomorrow as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(tomorrow);
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(today);
  expect(onChange).toHaveBeenCalledWith("2026-09-01");
  expect(onSubmit).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "2026-09-01" }),
  );
});

it("closes on Escape and returns focus to the trigger", async () => {
  render(createElement(DatePicker, { value: "2026-09-01", onChange: vi.fn() }));
  const trigger = screen.getByRole("button", { name: "2026-09-01" });
  fireEvent.click(trigger);
  const day = await findInPopover("button", { name: "1" });
  fireEvent.keyDown(day, { key: "Escape" });
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(trigger);
});

it("defaults today to the UTC date when no server date is supplied", async () => {
  process.env.TZ = "Etc/GMT+12";
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-01T00:30:00Z"));
  render(createElement(DatePicker, { value: "", onChange: vi.fn() }));
  fireEvent.click(screen.getByRole("button"));
  expect((await findInPopover("heading")).textContent).toBe("September 2026");
  expect(
    screen.getByRole("button", { name: "1" }).getAttribute("aria-current"),
  ).toBe("date");
});

it("follows changed values and resets the visible month when reopened", async () => {
  process.env.TZ = "Etc/GMT+12";
  const onChange = vi.fn();
  const { rerender } = render(
    createElement(DatePicker, { value: "2026-09-01", onChange }),
  );
  fireEvent.click(screen.getByRole("button", { name: "2026-09-01" }));
  await findInPopover("heading");
  rerender(createElement(DatePicker, { value: "2026-12-01", onChange }));
  expect(screen.getByRole("heading").textContent).toBe("December 2026");
  fireEvent.click(screen.getByRole("button", { name: "January 2027" }));
  expect(screen.getByRole("heading").textContent).toBe("January 2027");
  fireEvent.click(screen.getByRole("button", { name: "2026-12-01" }));
  fireEvent.click(screen.getByRole("button", { name: "2026-12-01" }));
  expect((await findInPopover("heading")).textContent).toBe("December 2026");
});
