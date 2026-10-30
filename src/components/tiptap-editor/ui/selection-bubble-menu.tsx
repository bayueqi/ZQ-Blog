import { TextSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import type { BubbleMenuProps } from "@tiptap/react/menus";
import { BubbleMenu } from "@tiptap/react/menus";
import type { LucideIcon } from "lucide-react";
import {
  Bold,
  Code,
  Italic,
  Link as LinkIcon,
  Sigma,
  Strikethrough,
  Underline as UnderlineIcon,
} from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { popoverMotionOrigin } from "@/components/ui/use-anchored-popover";
import { useLinkEditor } from "@/features/posts/editor/extensions/link-editing";
import { m } from "@/paraglide/messages";

/**
 * Shown on a non-empty text selection outside code blocks while the editor
 * (or the menu) has focus; never on a node selection or in a read-only editor.
 */
const shouldShow: NonNullable<BubbleMenuProps["shouldShow"]> = ({
  editor,
  element,
  view,
  state,
  from,
  to,
}) => {
  const { selection } = state;
  if (!editor.isEditable || !(selection instanceof TextSelection)) return false;
  if (selection.empty || !state.doc.textBetween(from, to).length) return false;
  if (selection.$from.parent.type.spec.code) return false;
  if (selection.$to.parent.type.spec.code) return false;
  return view.hasFocus() || element.contains(document.activeElement);
};

// Stable: BubbleMenu dispatches a transaction whenever its options change.
const MENU_OPTIONS: BubbleMenuProps["options"] = {
  placement: "top",
  offset: 8,
  shift: { padding: 8 },
};

// Until the editor's first transaction, its state is not read yet.
const NO_FORMATS = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  code: false,
  link: false,
};

function MenuButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  /** Set for the toggles; the formula button is an action. */
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <IconButton label={label} active={active} onClick={onClick}>
      <Icon size={14} strokeWidth={active ? 2.5 : 2} />
    </IconButton>
  );
}

/**
 * The menu beside selected text: text formatting, a link in place, and
 * turning the text into an inline formula.
 */
export function SelectionBubbleMenu({ editor }: { editor: Editor | null }) {
  const state =
    useEditorState({
      editor,
      selector: ({ editor: current }) =>
        current
          ? {
              bold: current.isActive("bold"),
              italic: current.isActive("italic"),
              underline: current.isActive("underline"),
              strike: current.isActive("strike"),
              code: current.isActive("code"),
              link: current.isActive("link"),
            }
          : null,
    }) ?? NO_FORMATS;

  // The link input takes the menu's place while it is open.
  const editingLink = useLinkEditor(editor) !== null;

  // Mount the menu with the editor, not on the first transaction: registering
  // its plugin rebuilds every plugin view, which would close an open slash menu.
  if (!editor) return null;

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="selectionBubbleMenu"
      shouldShow={shouldShow}
      options={MENU_OPTIONS}
      // Below the sticky toolbar when the selection scrolls under it.
      className="z-20"
    >
      {!editingLink && (
        <div
          role="toolbar"
          aria-label={m.editor_bubble_menu()}
          data-state="open"
          style={popoverMotionOrigin(true, "left")}
          className="fuwari-popover-motion flex items-center gap-0.5 rounded-xl bg-(--fuwari-card-bg) p-1 shadow-md ring-1 ring-(--fuwari-input-border)"
        >
          <MenuButton
            icon={Bold}
            label={m.editor_toolbar_bold()}
            active={state.bold}
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
          <MenuButton
            icon={Italic}
            label={m.editor_toolbar_italic()}
            active={state.italic}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
          <MenuButton
            icon={UnderlineIcon}
            label={m.editor_toolbar_underline()}
            active={state.underline}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          />
          <MenuButton
            icon={Strikethrough}
            label={m.editor_toolbar_strike()}
            active={state.strike}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          />
          <MenuButton
            icon={Code}
            label={m.editor_toolbar_code()}
            active={state.code}
            onClick={() => editor.chain().focus().toggleCode().run()}
          />
          <div className="mx-1 h-4 w-px bg-(--fuwari-meta-divider)" />
          <MenuButton
            icon={LinkIcon}
            label={m.editor_bubble_menu_link()}
            active={state.link}
            // The input takes focus itself; focusing the editor would steal it.
            onClick={() => editor.commands.openLinkEditor()}
          />
          <MenuButton
            icon={Sigma}
            label={m.editor_bubble_menu_inline_math()}
            // Opens the formula for editing, which takes focus itself.
            onClick={() => editor.commands.insertMath("inline")}
          />
        </div>
      )}
    </BubbleMenu>
  );
}
