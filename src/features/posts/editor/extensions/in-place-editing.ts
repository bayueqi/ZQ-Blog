import type { Editor } from "@tiptap/core";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { useCallback, useSyncExternalStore } from "react";

/**
 * What an extension has open for editing in place (a link input, a formula,
 * an image picker), kept in the editor state: transactions open and close
 * it, and it follows the document as it changes.
 */
export interface InPlaceEditing<T> {
  /** The plugin that keeps the state; the extension adds it to the editor. */
  plugin: () => Plugin<T | null>;
  /** What is open for editing in `state`, or `null` when nothing is. */
  get: (state: EditorState) => T | null;
  /** Opens `value` for editing once `tr` is applied. */
  open: (tr: Transaction, value: T) => void;
  /** Closes the editing once `tr` is applied. */
  close: (tr: Transaction) => void;
}

/**
 * The in-place editing state named `name`. `follow` moves what is open
 * through a transaction that changes the document, returning `null` to close
 * it once what it edits is gone.
 */
export function createInPlaceEditing<T>(
  name: string,
  follow: (value: T, tr: Transaction) => T | null,
): InPlaceEditing<T> {
  const key = new PluginKey<T | null>(name);
  return {
    plugin: () =>
      new Plugin<T | null>({
        key,
        state: {
          init: () => null,
          apply: (tr, value) => {
            const next = tr.getMeta(key) as T | null | undefined;
            if (next !== undefined) return next;
            if (!value || !tr.docChanged) return value;
            return follow(value, tr);
          },
        },
      }),
    get: (state) => key.getState(state) ?? null,
    open: (tr, value) => {
      tr.setMeta(key, value);
    },
    close: (tr) => {
      tr.setMeta(key, null);
    },
  };
}

/** What `editing` has open in `editor`, re-rendering as it opens, moves or closes. */
export function useInPlaceEditing<T>(
  editor: Editor | null,
  editing: InPlaceEditing<T>,
): T | null {
  const subscribe = useCallback(
    (listener: () => void) => {
      if (!editor) return () => {};
      editor.on("transaction", listener);
      return () => {
        editor.off("transaction", listener);
      };
    },
    [editor],
  );
  return useSyncExternalStore(
    subscribe,
    () => (editor ? editing.get(editor.state) : null),
    () => null,
  );
}
