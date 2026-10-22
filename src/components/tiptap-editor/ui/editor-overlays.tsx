import type { Editor } from "@tiptap/react";
import { SlashMenuView } from "@/features/posts/editor/extensions/slash-menu/slash-menu-view";
import { ImagePickerPopover } from "./image-picker-popover";
import { LinkEditorPopover } from "./link-editor-popover";
import { LinkHoverCard } from "./link-hover-card";
import { MathEditorPopover } from "./math-editor-popover";
import { SelectionBubbleMenu } from "./selection-bubble-menu";
import { TableBubbleMenu, TableMobileBar } from "./table-bubble-menu";

/**
 * The menus and popovers that float over an editable post editor: table
 * controls, the slash menu, the selection menu, and in-place editing of
 * links, images and formulas.
 */
export function EditorOverlays({ editor }: { editor: Editor | null }) {
  return (
    <>
      <TableBubbleMenu editor={editor} />
      <TableMobileBar editor={editor} />
      <SlashMenuView editor={editor} />
      <LinkEditorPopover editor={editor} />
      <LinkHoverCard editor={editor} />
      <SelectionBubbleMenu editor={editor} />
      <ImagePickerPopover editor={editor} />
      <MathEditorPopover editor={editor} />
    </>
  );
}
