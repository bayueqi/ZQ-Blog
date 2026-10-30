import type { Editor } from "@tiptap/core";
import { Extension, getMarkRange } from "@tiptap/core";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { normalizeLinkHref } from "@/lib/links/normalize-link-href";
import { createInPlaceEditing, useInPlaceEditing } from "../in-place-editing";

/** The open link input: the text it links and the link's current address. */
export interface LinkEditorState {
  /** The linked text; empty when applying inserts the URL as new text. */
  from: number;
  to: number;
  /** The link's address, or "" for a new link. */
  href: string;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    linkEditing: {
      /**
       * Opens the link input for the selected text, or, with the cursor in a
       * link, for that link. Otherwise applying inserts the URL as linked
       * text at the cursor.
       */
      openLinkEditor: () => ReturnType;
      /**
       * Applies the open input: links its text to the normalised `url`,
       * removes the link when `url` is empty, and closes the input.
       */
      applyLink: (url: string) => ReturnType;
      /** Closes the link input without changing the document. */
      closeLinkEditor: () => ReturnType;
    };
  }
}

/** Moves the input's text through `tr`; closes once that text is gone. */
function followTarget(
  target: LinkEditorState,
  tr: Transaction,
): LinkEditorState | null {
  const { from, to } = target;
  if (from === to) {
    const pos = tr.mapping.map(from);
    return pos === from ? target : { ...target, from: pos, to: pos };
  }
  const next = { from: tr.mapping.map(from, 1), to: tr.mapping.map(to, -1) };
  if (next.from >= next.to) return null;
  return next.from === from && next.to === to ? target : { ...target, ...next };
}

const linkEditor = createInPlaceEditing("linkEditing", followTarget);

/**
 * What the link input edits: the whole link when the selection lies inside
 * one, otherwise the selection itself.
 */
function linkTarget(selection: EditorState["selection"]): LinkEditorState {
  const { from, to, $from } = selection;
  const type = $from.doc.type.schema.marks.link;
  const range = type ? getMarkRange($from, type) : undefined;
  if (range && range.from <= from && to <= range.to) {
    const mark = $from.doc
      .nodeAt(range.from)
      ?.marks.find((candidate) => candidate.type === type);
    return { ...range, href: String(mark?.attrs.href ?? "") };
  }
  return { from, to, href: "" };
}

/**
 * Edits links in place: Mod-k or the toolbar opens a link input beside the
 * selection, which the `Editor` component renders. Never opens in a
 * read-only editor.
 */
export const LinkEditing = Extension.create({
  name: "linkEditing",

  addProseMirrorPlugins() {
    return [linkEditor.plugin()];
  },

  addKeyboardShortcuts() {
    return {
      "Mod-k": () => this.editor.commands.openLinkEditor(),
    };
  },

  addCommands() {
    return {
      openLinkEditor:
        () =>
        ({ editor, tr, dispatch }) => {
          if (!editor.isEditable) return false;
          if (dispatch) linkEditor.open(tr, linkTarget(tr.selection));
          return true;
        },
      applyLink:
        (url) =>
        ({ state, tr, chain, dispatch }) => {
          const target = linkEditor.get(state);
          if (!target) return false;
          if (!dispatch) return true;
          linkEditor.close(tr);
          const text = url.trim();
          const href = normalizeLinkHref(text);
          const { from, to } = target;
          if (from === to) {
            if (!href) return chain().focus().run();
            return (
              chain()
                .insertContentAt(from, {
                  type: "text",
                  text,
                  marks: [{ type: "link", attrs: { href } }],
                })
                .focus()
                // Typing on after the new link is plain text.
                .unsetMark("link")
                .run()
            );
          }
          const linked = chain().setTextSelection({ from, to });
          if (!href) return linked.unsetLink().focus().run();
          return linked.setLink({ href }).focus().run();
        },
      closeLinkEditor:
        () =>
        ({ state, tr, dispatch }) => {
          if (!linkEditor.get(state)) return false;
          if (dispatch) linkEditor.close(tr);
          return true;
        },
    };
  },
});

/** The open link input, or `null` when it is closed. */
export function getLinkEditor(editor: Editor): LinkEditorState | null {
  return linkEditor.get(editor.state);
}

/** The open link input, re-rendering as it opens, moves or closes. */
export function useLinkEditor(editor: Editor | null) {
  return useInPlaceEditing(editor, linkEditor);
}
