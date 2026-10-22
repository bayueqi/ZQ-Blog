import type { KeyboardEvent } from "react";

const STEPS: Record<string, number> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

/**
 * Arrow keys, Home and End move the selection along a row of options marked
 * with `data-value`, skipping disabled ones, and focus the option they land on.
 */
export function moveSelection<T extends string>(
  event: KeyboardEvent<HTMLElement>,
  options: ReadonlyArray<{ value: T; disabled?: boolean }>,
  value: T,
  onValueChange: (value: T) => void,
) {
  const enabled = options.filter((option) => !option.disabled);
  if (!enabled.length) return;
  const index = enabled.findIndex((option) => option.value === value);
  const step = STEPS[event.key];
  const nextIndex =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? enabled.length - 1
        : step
          ? (index + step + enabled.length) % enabled.length
          : undefined;
  if (nextIndex === undefined) return;
  event.preventDefault();
  const next = enabled[nextIndex].value;
  onValueChange(next);
  Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[data-value]"))
    .find((element) => element.dataset.value === next)
    ?.focus();
}
