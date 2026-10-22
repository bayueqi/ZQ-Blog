import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import clsx from "clsx";
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo,
  Sigma,
  SquareFunction,
  Strikethrough,
  Terminal,
  Underline as UnderlineIcon,
  Undo,
  Video,
} from "lucide-react";
import type React from "react";
import { m } from "@/paraglide/messages";
import { TableSizePicker } from "./table-size-picker";
import { ToolbarButton } from "./toolbar-button";

interface EditorToolbarProps {
  className?: string;
  editor: Editor | null;
  onLinkClick: () => void;
  onImageClick: () => void;
  onVideoClick: () => void;
  onFormulaInlineClick: () => void;
  onFormulaBlockClick: () => void;
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({
  editor,
  className,
  onLinkClick,
  onImageClick,
  onVideoClick,
  onFormulaInlineClick,
  onFormulaBlockClick,
}) => {
  const {
    isBold,
    isHeading2,
    isHeading3,
    isItalic,
    isUnderline,
    isStrike,
    isCode,
    isCodeBlock,
    isInlineMath,
    isBlockMath,
    isBulletList,
    isOrderedList,
    isBlockquote,
    isLink,
  } = useEditorState({
    editor,
    selector: (ctx) => {
      if (!ctx.editor) {
        return {
          isBold: false,
          isHeading2: false,
          isHeading3: false,
          isItalic: false,
          isUnderline: false,
          isStrike: false,
          isCode: false,
          isBulletList: false,
          isOrderedList: false,
          isBlockquote: false,
          isLink: false,
          isInlineMath: false,
          isBlockMath: false,
        };
      }
      return {
        isBold: ctx.editor.isActive("bold"),
        isHeading2: ctx.editor.isActive("heading", { level: 2 }),
        isHeading3: ctx.editor.isActive("heading", { level: 3 }),
        isItalic: ctx.editor.isActive("italic"),
        isUnderline: ctx.editor.isActive("underline"),
        isStrike: ctx.editor.isActive("strike"),
        isCode: ctx.editor.isActive("code"),
        isCodeBlock: ctx.editor.isActive("codeBlock"),
        isInlineMath: ctx.editor.isActive("inlineMath"),
        isBlockMath: ctx.editor.isActive("blockMath"),
        isBulletList: ctx.editor.isActive("bulletList"),
        isOrderedList: ctx.editor.isActive("orderedList"),
        isBlockquote: ctx.editor.isActive("blockquote"),
        isLink: ctx.editor.isActive("link"),
      };
    },
  }) || {
    isBold: false,
    isHeading2: false,
    isHeading3: false,
    isItalic: false,
    isUnderline: false,
    isStrike: false,
    isCode: false,
    isCodeBlock: false,
    isInlineMath: false,
    isBlockMath: false,
    isBulletList: false,
    isOrderedList: false,
    isBlockquote: false,
    isLink: false,
  };

  return (
    <div
      className={clsx(
        "sticky top-0 z-30 mb-6 flex flex-wrap items-center gap-1 border-b border-(--fuwari-input-border) bg-(--fuwari-card-bg) py-2",
        className,
      )}
    >
      {/* Headings */}
      <ToolbarButton
        onClick={() =>
          editor?.chain().focus().toggleHeading({ level: 2 }).run()
        }
        isActive={isHeading2}
        icon={Heading2}
        label={m.editor_toolbar_heading2()}
      />
      <ToolbarButton
        onClick={() =>
          editor?.chain().focus().toggleHeading({ level: 3 }).run()
        }
        isActive={isHeading3}
        icon={Heading3}
        label={m.editor_toolbar_heading3()}
      />

      <div className="mx-2 h-4 w-px bg-(--fuwari-meta-divider)"></div>

      {/* Formatting */}
      <ToolbarButton
        onClick={() => editor?.chain().focus().toggleBold().run()}
        isActive={isBold}
        icon={Bold}
        label={m.editor_toolbar_bold()}
      />
      <ToolbarButton
        onClick={() => editor?.chain().focus().toggleItalic().run()}
        isActive={isItalic}
        icon={Italic}
        label={m.editor_toolbar_italic()}
      />
      <ToolbarButton
        onClick={() => editor?.chain().focus().toggleUnderline().run()}
        isActive={isUnderline}
        icon={UnderlineIcon}
        label={m.editor_toolbar_underline()}
      />
      <ToolbarButton
        onClick={() => editor?.chain().focus().toggleStrike().run()}
        isActive={isStrike}
        icon={Strikethrough}
        label={m.editor_toolbar_strike()}
      />
      <ToolbarButton
        onClick={() => editor?.chain().focus().toggleCode().run()}
        isActive={isCode}
        icon={Code}
        label={m.editor_toolbar_code()}
      />
      <ToolbarButton
        onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
        isActive={isCodeBlock}
        icon={Terminal}
        label={m.editor_toolbar_code_block()}
      />
      <ToolbarButton
        onClick={onFormulaInlineClick}
        isActive={isInlineMath}
        icon={Sigma}
        label={m.editor_toolbar_formula_inline()}
      />
      <ToolbarButton
        onClick={onFormulaBlockClick}
        isActive={isBlockMath}
        icon={SquareFunction}
        label={m.editor_toolbar_formula_block()}
      />

      <div className="mx-2 h-4 w-px bg-(--fuwari-meta-divider)"></div>

      {/* Lists & Blocks */}
      <ToolbarButton
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
        isActive={isBulletList}
        icon={List}
        label={m.editor_toolbar_bullet_list()}
      />
      <ToolbarButton
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        isActive={isOrderedList}
        icon={ListOrdered}
        label={m.editor_toolbar_ordered_list()}
      />
      <ToolbarButton
        onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        isActive={isBlockquote}
        icon={Quote}
        label={m.editor_toolbar_blockquote()}
      />
      <TableSizePicker editor={editor} isActive={editor?.isActive("table")} />

      <div className="mx-2 h-4 w-px bg-(--fuwari-meta-divider)"></div>

      {/* Inserts */}
      <ToolbarButton
        onClick={onLinkClick}
        isActive={isLink}
        icon={LinkIcon}
        label={m.editor_toolbar_link()}
      />
      <ToolbarButton
        onClick={onImageClick}
        isActive={false}
        icon={ImageIcon}
        label={m.editor_toolbar_image()}
      />
      <ToolbarButton
        onClick={onVideoClick}
        isActive={false}
        icon={Video}
        label={m.editor_toolbar_video()}
      />

      <div className="ml-auto flex gap-1">
        <ToolbarButton
          onClick={() => editor?.chain().focus().undo().run()}
          icon={Undo}
          label={m.editor_toolbar_undo()}
        />
        <ToolbarButton
          onClick={() => editor?.chain().focus().redo().run()}
          icon={Redo}
          label={m.editor_toolbar_redo()}
        />
      </div>
    </div>
  );
};

export default EditorToolbar;
