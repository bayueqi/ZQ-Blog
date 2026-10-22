// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { findInPopover } from "tests/popover";
import { afterEach, expect, it, vi } from "vitest";
import { ActionMenu, type ActionMenuItem } from "./action-menu";

// Unmount the menu as soon as it closes; exit motion is not under test.
vi.mock("@/hooks/use-motion", () => ({
  MOTION: { popover: 120 },
  useMotionPresence: (open: boolean) => open,
}));

afterEach(cleanup);

function renderMenu(items: Array<ActionMenuItem>) {
  render(
    createElement(
      "div",
      null,
      createElement(ActionMenu, { label: "More", items }),
      createElement("button", { type: "button" }, "After"),
    ),
  );
  return screen.getByRole("button", { name: "More" });
}

const items = () => [
  { label: "Edit", onSelect: vi.fn() },
  { label: "Archive", onSelect: vi.fn(), disabled: true },
  { label: "Delete", onSelect: vi.fn(), danger: true },
];

it("opens on the first or last command from the keyboard, skipping disabled ones", async () => {
  const trigger = renderMenu(items());

  fireEvent.keyDown(trigger, { key: "ArrowUp" });
  const del = await findInPopover("menuitem", { name: "Delete" });
  expect(document.activeElement).toBe(del);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");

  fireEvent.keyDown(del, { key: "ArrowUp" });
  expect(document.activeElement?.textContent).toBe("Edit");
  fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" });
  expect(document.activeElement).toBe(del);
});

it("runs a command after closing, handing it the focused trigger", async () => {
  const menu = items();
  const trigger = renderMenu(menu);
  fireEvent.click(trigger);

  fireEvent.click(await findInPopover("menuitem", { name: "Delete" }));

  expect(screen.queryByRole("menu")).toBeNull();
  expect(menu[2].onSelect).toHaveBeenCalledWith(trigger);
  expect(document.activeElement).toBe(trigger);
  expect(menu[0].onSelect).not.toHaveBeenCalled();
});

it("closes on Tab from the trigger's place in the page", async () => {
  const trigger = renderMenu(items());
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  const edit = await findInPopover("menuitem", { name: "Edit" });

  fireEvent.keyDown(edit, { key: "Tab" });

  expect(screen.queryByRole("menu")).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

it("marks toggles as checkable", async () => {
  const trigger = renderMenu([
    { label: "Header row", onSelect: vi.fn(), checked: true },
  ]);
  fireEvent.click(trigger);

  const toggle = await findInPopover("menuitemcheckbox", {
    name: "Header row",
  });
  expect(toggle.getAttribute("aria-checked")).toBe("true");
});

it("renders nothing without commands", () => {
  render(createElement(ActionMenu, { label: "More", items: [] }));
  expect(screen.queryByRole("button")).toBeNull();
});
