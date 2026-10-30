import {
  screen,
  waitFor,
  type ByRoleMatcher,
  type ByRoleOptions,
} from "@testing-library/react";

/**
 * Finds `role` in a floating popover once a user can use it: the panel is
 * positioned and shown (`data-state="open"`), and so already holds its
 * initial focus. A popover renders hidden until its async positioning lands,
 * so acting on it any earlier races that positioning.
 *
 * `role` may be the panel's own role or one inside it.
 */
export function findInPopover(
  role: ByRoleMatcher,
  options?: ByRoleOptions,
): Promise<HTMLElement> {
  return waitFor(() => {
    const element = screen.getByRole(role, options);
    const state = element.closest("[data-state]")?.getAttribute("data-state");
    if (state !== "open")
      throw new Error(`The popover holding ${String(role)} is not open yet.`);
    return element;
  });
}
