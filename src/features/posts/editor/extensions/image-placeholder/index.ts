import type { Editor, JSONContent } from "@tiptap/core";
import { mergeAttributes, Node } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";
import { NodeSelection } from "@tiptap/pm/state";
import { Transform } from "@tiptap/pm/transform";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { createInPlaceEditing, useInPlaceEditing } from "../in-place-editing";
import { ImagePlaceholderView } from "./image-placeholder-view";

export const IMAGE_PLACEHOLDER = "imagePlaceholder";

/** The placeholder the image picker fills. */
export interface ImagePickerState {
  pos: number;
}

export interface PickedImage {
  src: string;
  width?: number;
  height?: number;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    imagePlaceholder: {
      /**
       * Inserts an image placeholder at the selection, in place of an empty
       * line, and opens the image picker for it.
       */
      insertImagePlaceholder: () => ReturnType;
      /** Opens the image picker for the placeholder at `pos`. */
      openImagePicker: (pos: number) => ReturnType;
      /** Closes the image picker and keeps its placeholder. */
      closeImagePicker: () => ReturnType;
      /** Replaces the picker's placeholder with `image`. */
      fillImagePlaceholder: (image: PickedImage) => ReturnType;
      /**
       * Replaces the picker's placeholder with `file`, which shows its upload
       * progress in place until it becomes the uploaded image.
       */
      uploadImageToPlaceholder: (file: File) => ReturnType;
    };
  }
}

function isPlaceholderAt(doc: ProseMirrorNode, pos: number) {
  return doc.nodeAt(pos)?.type.name === IMAGE_PLACEHOLDER;
}

/** The open image picker, following its placeholder; closed once it is gone. */
const imagePicker = createInPlaceEditing<ImagePickerState>(
  "imagePicker",
  (picker, tr) => {
    const { pos, deleted } = tr.mapping.mapResult(picker.pos, 1);
    if (deleted || !isPlaceholderAt(tr.doc, pos)) return null;
    return pos === picker.pos ? picker : { pos };
  },
);

/** The open picker's placeholder, with its current size. */
function pickerTarget(state: EditorState) {
  const picker = imagePicker.get(state);
  const node = picker ? state.doc.nodeAt(picker.pos) : null;
  if (!picker || node?.type.name !== IMAGE_PLACEHOLDER) return null;
  return { from: picker.pos, to: picker.pos + node.nodeSize };
}

/**
 * An editor-only block that marks where an image goes until one is picked.
 * Inserting it opens the image picker below it, which the `Editor` component
 * renders; clicking it, or Enter while it is selected, reopens the picker.
 * Post content is saved without placeholders, and the public renderer does
 * not know the node.
 */
export const ImagePlaceholder = Node.create({
  name: IMAGE_PLACEHOLDER,
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  parseHTML() {
    return [{ tag: 'div[data-type="image-placeholder"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "image-placeholder" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImagePlaceholderView);
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { selection } = editor.state;
        if (
          !(selection instanceof NodeSelection) ||
          selection.node.type.name !== IMAGE_PLACEHOLDER
        ) {
          return false;
        }
        return editor.commands.openImagePicker(selection.from);
      },
    };
  },

  addProseMirrorPlugins() {
    return [imagePicker.plugin()];
  },

  addCommands() {
    return {
      insertImagePlaceholder:
        () =>
        ({ editor, tr, dispatch }) => {
          if (!editor.isEditable) return false;
          if (!dispatch) return true;
          const { from, to } = tr.selection;
          tr.replaceSelectionWith(this.type.create());
          let pos = -1;
          tr.doc.nodesBetween(
            tr.mapping.map(from, -1),
            tr.mapping.map(to, 1),
            (node, nodePos) => {
              if (pos < 0 && node.type === this.type) pos = nodePos;
              return pos < 0;
            },
          );
          if (pos < 0) return false;
          tr.setSelection(NodeSelection.create(tr.doc, pos));
          imagePicker.open(tr, { pos });
          return true;
        },
      openImagePicker:
        (pos) =>
        ({ editor, state, tr, dispatch }) => {
          if (!editor.isEditable || !isPlaceholderAt(state.doc, pos)) {
            return false;
          }
          if (dispatch) imagePicker.open(tr, { pos });
          return true;
        },
      closeImagePicker:
        () =>
        ({ state, tr, dispatch }) => {
          if (!imagePicker.get(state)) return false;
          if (dispatch) imagePicker.close(tr);
          return true;
        },
      fillImagePlaceholder:
        (image) =>
        ({ state, tr, dispatch }) => {
          const target = pickerTarget(state);
          if (!target) return false;
          if (!dispatch) return true;
          const node = state.schema.nodes.image.create({
            src: image.src,
            width: image.width || null,
            height: image.height || null,
          });
          tr.replaceWith(target.from, target.to, node);
          tr.setSelection(NodeSelection.create(tr.doc, target.from));
          imagePicker.close(tr);
          return true;
        },
      uploadImageToPlaceholder:
        (file) =>
        ({ state, tr, commands }) => {
          const target = pickerTarget(state);
          if (!target) return false;
          imagePicker.close(tr);
          return commands.uploadImage(file, target);
        },
    };
  },
});

/** The open image picker, or `null` when it is closed. */
export function getImagePicker(editor: Editor): ImagePickerState | null {
  return imagePicker.get(editor.state);
}

/** The open image picker, re-rendering as it opens, moves or closes. */
export function useImagePicker(editor: Editor | null) {
  return useInPlaceEditing(editor, imagePicker);
}

/**
 * The document as post content: placeholders that were never filled are
 * left out, so they are neither saved nor published.
 */
export function postContentOf(doc: ProseMirrorNode): JSONContent {
  const placeholders: Array<{ from: number; to: number }> = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== IMAGE_PLACEHOLDER) return true;
    placeholders.push({ from: pos, to: pos + node.nodeSize });
    return false;
  });
  if (placeholders.length === 0) return doc.toJSON() as JSONContent;
  const transform = new Transform(doc);
  for (const { from, to } of placeholders.reverse()) {
    transform.delete(from, to);
  }
  return transform.doc.toJSON() as JSONContent;
}
