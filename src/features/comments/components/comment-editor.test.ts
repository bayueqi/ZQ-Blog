// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { createElement, useEffect, useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { m } from "@/paraglide/messages";
import { CommentEditor } from "./comment-editor";
import { CommentReveal } from "./comment-reveal";

// Keep the exit shell present so the test covers its inactive state.
vi.mock("@/hooks/use-motion", () => ({
  MOTION: { panel: 320 },
  useMotionPresence: () => true,
}));

afterEach(cleanup);

it("keeps the controlled draft after a failed submit and shows an inline error", async () => {
  const originalDraft = "  A reply\nwith a second line  ";
  const onSubmit = vi.fn().mockRejectedValue(new Error("Network unavailable"));
  function Draft() {
    const [value, onChange] = useState(originalDraft);
    return createElement(CommentEditor, { value, onChange, onSubmit });
  }
  render(createElement(Draft));
  const input = screen.getByRole("textbox") as HTMLTextAreaElement;

  await act(async () =>
    fireEvent.click(
      screen.getByRole("button", {
        name: m.comments_editor_submit(),
      }),
    ),
  );

  expect(onSubmit).toHaveBeenCalledExactlyOnceWith(originalDraft.trim());
  expect(input.value).toBe(originalDraft);
  const error = screen.getByRole("alert");
  expect(error.textContent).toBe(m.comments_send_failed_keep_draft());
  expect(input.getAttribute("aria-describedby")).toBe(error.id);

  fireEvent.change(input, { target: { value: "Revised draft" } });
  expect(input.value).toBe("Revised draft");
  expect(screen.queryByRole("alert")).toBeNull();
});

it.each(["isSubmitting", "challengePending"] as const)(
  "prevents sending while %s is true",
  async (pendingProp) => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      createElement(CommentEditor, {
        value: "A draft",
        onChange: vi.fn(),
        onSubmit,
        [pendingProp]: true,
      }),
    );
    const input = screen.getByRole("textbox") as HTMLTextAreaElement;
    const send = screen.getByRole("button", {
      name: m.comments_editor_submit(),
    }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);

    // Submitting the form directly also covers a keyboard-triggered submit.
    await act(async () => fireEvent.submit(input.form!));
    expect(onSubmit).not.toHaveBeenCalled();
  },
);

it("removes the challenge immediately while retaining an inert editor for its exit", async () => {
  const challengeUnmount = vi.fn();
  function Challenge() {
    useEffect(() => challengeUnmount, []);
    return createElement("button", { type: "button" }, "Verify challenge");
  }
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const editor = createElement(CommentEditor, {
    value: "Keep this reply",
    onChange: vi.fn(),
    onSubmit,
    challenge: createElement(Challenge),
  });
  const { rerender } = render(
    createElement(CommentReveal, {
      open: true,
      children: editor,
    }),
  );
  const input = screen.getByRole("textbox") as HTMLTextAreaElement;
  const form = input.form!;
  const send = screen.getByRole("button", {
    name: m.comments_editor_submit(),
  }) as HTMLButtonElement;
  expect(
    screen.getByRole("button", { name: "Verify challenge" }),
  ).toBeDefined();

  rerender(createElement(CommentReveal, { open: false, children: null }));

  expect(challengeUnmount).toHaveBeenCalledOnce();
  expect(screen.queryByText("Verify challenge")).toBeNull();
  expect(input.isConnected).toBe(true);
  expect(input.value).toBe("Keep this reply");
  expect(input.disabled).toBe(true);
  expect(send.disabled).toBe(true);
  expect(input.closest("[aria-hidden='true'][inert]")).not.toBeNull();
  await act(async () => fireEvent.submit(form));
  expect(onSubmit).not.toHaveBeenCalled();
});
