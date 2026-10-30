// @vitest-environment jsdom
import type { Editor, JSONContent } from "@tiptap/core";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { contentHasBlobUrl } from "@/features/posts/components/post-editor/post-editor.model";
import { createPostEditor, pressKey } from "@/features/posts/editor/test-utils";
import type { orpcClient } from "@/lib/orpc";
import { getImagePicker, postContentOf } from ".";

const requests = vi.hoisted(() => ({
  upload: vi.fn<typeof orpcClient.media.upload>(),
}));
vi.mock("@/lib/orpc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/orpc")>()),
  orpcClient: { media: { upload: requests.upload } },
}));

let editor: Editor | undefined;

beforeAll(() => {
  // jsdom has no object URLs; name them after the file.
  Object.assign(URL, {
    createObjectURL: (file: File) => `blob:${file.name.split(".")[0]}`,
    revokeObjectURL: () => {},
  });
});

afterEach(() => {
  editor?.destroy();
  editor = undefined;
  requests.upload.mockReset();
});

/** An editor with the cursor at `pos`. */
function open(content: string, pos: number) {
  editor = createPostEditor({ content });
  editor.commands.setTextSelection(pos);
  return editor;
}

/** The document's top-level nodes, with an image's source in brackets. */
function outline(target: Editor) {
  return (target.getJSON().content ?? []).map((node: JSONContent) =>
    node.type === "image" ? `image[${String(node.attrs?.src)}]` : node.type,
  );
}

it("inserts a placeholder on an empty line and opens the picker for it", () => {
  const target = open("<p>a</p><p></p><p>b</p>", 4);

  expect(target.commands.insertImagePlaceholder()).toBe(true);

  expect(outline(target)).toEqual([
    "paragraph",
    "imagePlaceholder",
    "paragraph",
  ]);
  expect(getImagePicker(target)).toEqual({ pos: 3 });
});

it("replaces the placeholder with the chosen image in place", () => {
  const target = open("<p>a</p><p></p><p>b</p>", 4);
  target.commands.insertImagePlaceholder();

  target.commands.fillImagePlaceholder({
    src: "/images/cat.png",
    width: 640,
    height: 480,
  });

  expect(outline(target)).toEqual([
    "paragraph",
    "image[/images/cat.png]",
    "paragraph",
  ]);
  const image = target.getJSON().content?.[1];
  expect(image?.attrs).toMatchObject({ width: 640, height: 480 });
  expect(getImagePicker(target)).toBeNull();
});

it("splits the paragraph when inserting in the middle of text", () => {
  const target = open("<p>ab</p>", 2);

  target.commands.insertImagePlaceholder();

  expect(outline(target)).toEqual([
    "paragraph",
    "imagePlaceholder",
    "paragraph",
  ]);
  expect(target.getText({ blockSeparator: "|" })).toBe("a||b");
  expect(getImagePicker(target)).toEqual({ pos: 3 });
});

it("keeps the placeholder when the picker closes, and reopens it", () => {
  const target = open("<p></p><p>b</p>", 1);
  target.commands.insertImagePlaceholder();

  target.commands.closeImagePicker();
  expect(getImagePicker(target)).toBeNull();
  expect(outline(target)).toEqual(["imagePlaceholder", "paragraph"]);

  expect(target.commands.openImagePicker(0)).toBe(true);
  expect(getImagePicker(target)).toEqual({ pos: 0 });
});

it("reopens the picker on Enter while the placeholder is selected", () => {
  const target = open("<p></p><p>b</p>", 1);
  target.commands.insertImagePlaceholder();
  target.commands.closeImagePicker();
  target.commands.setNodeSelection(0);

  expect(pressKey(target, "Enter")).toBe(true);

  expect(getImagePicker(target)).toEqual({ pos: 0 });
  expect(outline(target)).toEqual(["imagePlaceholder", "paragraph"]);
});

it("follows its placeholder through edits and closes once it is deleted", () => {
  const target = open("<p>a</p><p></p>", 4);
  target.commands.insertImagePlaceholder();

  target.commands.insertContentAt(1, "xyz");
  expect(getImagePicker(target)).toEqual({ pos: 6 });

  target.commands.deleteRange({ from: 6, to: 7 });
  expect(getImagePicker(target)).toBeNull();
});

it("does not insert a placeholder in a read-only editor", () => {
  editor = createPostEditor({ content: "<p></p>", editable: false });

  expect(editor.commands.insertImagePlaceholder()).toBe(false);
  expect(outline(editor)).toEqual(["paragraph"]);
});

it.each([
  [
    "between paragraphs",
    "<p>a</p><p></p><p>b</p>",
    4,
    ["paragraph", "paragraph"],
  ],
  ["as the only block", "<p></p>", 1, ["paragraph"]],
])(
  "leaves an unfilled placeholder out of the post content (%s)",
  (_, content, pos, expected) => {
    const target = open(content, pos);
    target.commands.insertImagePlaceholder();

    const saved = postContentOf(target.state.doc);

    expect(saved.content?.map((node) => node.type)).toEqual(expected);
    expect(JSON.stringify(saved)).not.toContain("imagePlaceholder");
  },
);

it("leaves a placeholder inside a quote out without emptying the quote", () => {
  const target = open("<blockquote><p></p></blockquote>", 2);
  target.commands.insertImagePlaceholder();
  expect(JSON.stringify(target.getJSON())).toContain("imagePlaceholder");

  const saved = postContentOf(target.state.doc);

  expect(saved.content?.[0]).toEqual({
    type: "blockquote",
    content: [{ type: "paragraph" }],
  });
});

it("keeps filled images in the post content", () => {
  const target = open("<p></p><p></p>", 1);
  target.commands.insertImagePlaceholder();
  target.commands.fillImagePlaceholder({ src: "/images/cat.png" });
  target.commands.setTextSelection(target.state.doc.content.size - 1);
  target.commands.insertImagePlaceholder();

  const saved = postContentOf(target.state.doc);

  // The trailing paragraph is the editor's own.
  expect(saved.content?.map((node) => node.type)).toEqual([
    "image",
    "paragraph",
  ]);
});

it("uploads a file into the placeholder, showing it in place until it is uploaded", async () => {
  type Uploaded = Awaited<ReturnType<typeof orpcClient.media.upload>>;
  let finish!: (result: Uploaded) => void;
  requests.upload.mockReturnValueOnce(
    new Promise<Uploaded>((resolve) => {
      finish = resolve;
    }),
  );
  const target = open("<p>a</p><p></p><p>b</p>", 4);
  target.commands.insertImagePlaceholder();
  const file = new File(["png"], "cat.png", { type: "image/png" });

  expect(target.commands.uploadImageToPlaceholder(file)).toBe(true);

  expect(requests.upload).toHaveBeenCalledWith({ image: file });
  expect(outline(target)).toEqual([
    "paragraph",
    "image[blob:cat]",
    "paragraph",
  ]);
  expect(getImagePicker(target)).toBeNull();
  // An upload in progress holds back saving until it finishes.
  expect(contentHasBlobUrl(postContentOf(target.state.doc))).toBe(true);

  finish({
    id: 1,
    key: "cat.png",
    url: "/images/cat.png",
    fileName: "cat.png",
    mimeType: "image/png",
    sizeInBytes: 3,
    width: 640,
    height: 480,
    createdAt: new Date("2026-10-05T00:00:00Z"),
  });
  await vi.waitFor(() =>
    expect(outline(target)).toEqual([
      "paragraph",
      "image[/images/cat.png]",
      "paragraph",
    ]),
  );
});
