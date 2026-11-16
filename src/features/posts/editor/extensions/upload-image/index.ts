import type { Range } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";

export interface ImageUploadResult {
  url: string;
  width?: number;
  height?: number;
}

interface ImageUploadOptions {
  onUpload: (file: File) => Promise<ImageUploadResult>;
  onError?: (error: Error) => void;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    imageUpload: {
      /**
       * Inserts `file` as an image at `at` (the selection by default), or in
       * place of the range `at`, and swaps in the uploaded address once the
       * upload finishes. A failed upload removes the image.
       */
      uploadImage: (file: File, at?: number | Range) => ReturnType;
      /** The same for a video file, which becomes a `videoFile` block. */
      uploadVideo: (file: File, at?: number | Range) => ReturnType;
    };
  }
}

function findPosByUploadId(view: EditorView, uploadId: string) {
  let found: number | null = null;
  view.state.doc.descendants((descendant: ProseMirrorNode, nodePos: number) => {
    if (found != null) return false;
    if (descendant.attrs.uploadId === uploadId) {
      found = nodePos;
      return false;
    }
    return true;
  });
  return found;
}

/**
 * Puts `file` in the document at `at` as a `nodeName` block pointing at a
 * blob address, then swaps in the uploaded address once it is up; a failed
 * upload removes the block again.
 */
function uploadInto(
  options: ImageUploadOptions,
  nodeName: "image" | "videoFile",
  file: File,
  at: number | Range | undefined,
  tr: Transaction,
  state: EditorState,
  view: EditorView,
) {
  const type = state.schema.nodes[nodeName];
  if (!type) return false;

  const uploadId = crypto.randomUUID();
  const blobUrl = URL.createObjectURL(file);
  const node = type.create({
    src: blobUrl,
    uploadId,
    ...(nodeName === "image" ? { alt: file.name } : {}),
  });
  if (typeof at === "object") {
    tr.replaceWith(at.from, at.to, node);
  } else {
    tr.insert(at ?? tr.selection.from, node);
  }

  const removePlaceholder = () => {
    if (view.isDestroyed) {
      URL.revokeObjectURL(blobUrl);
      return;
    }
    const nodePos = findPosByUploadId(view, uploadId);
    if (nodePos == null) {
      URL.revokeObjectURL(blobUrl);
      return;
    }
    const current = view.state.doc.nodeAt(nodePos);
    view.dispatch(
      view.state.tr.delete(nodePos, nodePos + (current?.nodeSize ?? 1)),
    );
    URL.revokeObjectURL(blobUrl);
  };

  options
    .onUpload(file)
    .then((result) => {
      if (view.isDestroyed) {
        URL.revokeObjectURL(blobUrl);
        return;
      }
      const nodePos = findPosByUploadId(view, uploadId);
      if (nodePos == null) {
        URL.revokeObjectURL(blobUrl);
        return;
      }
      const current = view.state.doc.nodeAt(nodePos);
      if (!current) {
        URL.revokeObjectURL(blobUrl);
        return;
      }
      view.dispatch(
        view.state.tr.setNodeMarkup(nodePos, undefined, {
          ...current.attrs,
          src: result.url,
          width: result.width || current.attrs.width,
          height: result.height || current.attrs.height,
          uploadId: null,
        }),
      );
      URL.revokeObjectURL(blobUrl);
    })
    .catch((error) => {
      console.error("Upload failed", error);
      options.onError?.(error);
      removePlaceholder();
    });

  return true;
}

export const ImageUpload = Extension.create<ImageUploadOptions>({
  name: "imageUpload",

  addOptions() {
    return {
      onUpload: async () => ({ url: "" }),
      onError: undefined,
    };
  },

  addCommands() {
    return {
      uploadImage:
        (file: File, at?: number | Range) =>
        ({ tr, dispatch, state, view }) => {
          if (!dispatch) return true;
          return uploadInto(this.options, "image", file, at, tr, state, view);
        },
      uploadVideo:
        (file: File, at?: number | Range) =>
        ({ tr, dispatch, state, view }) => {
          if (!dispatch) return true;
          return uploadInto(this.options, "videoFile", file, at, tr, state, view);
        },
    };
  },
});
