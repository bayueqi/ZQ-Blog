import type { Editor, Range } from "@tiptap/core";
import type { LucideIcon } from "lucide-react";
import {
  Code,
  Heading2,
  Heading3,
  Heading4,
  Image as ImageIcon,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  SquareFunction,
  Table as TableIcon,
  Video,
  Workflow,
} from "lucide-react";
import { MERMAID } from "@/lib/code-languages";
import { m } from "@/paraglide/messages";

export interface SlashMenuItemContext {
  editor: Editor;
  /** The typed `/` and filter text, which the item replaces. */
  range: Range;
}

export interface SlashMenuItem {
  id: string;
  /** The localized name shown in the menu; it is also matched by the filter. */
  title: () => string;
  /**
   * Extra filter terms. List the Chinese name and English words so either
   * matches in both UI languages.
   */
  keywords: ReadonlyArray<string>;
  icon: LucideIcon;
  run: (context: SlashMenuItemContext) => void;
}

function replaceWith(
  { editor, range }: SlashMenuItemContext,
  insert: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>,
) {
  insert(editor.chain().focus().deleteRange(range)).run();
}

function heading(level: 2 | 3 | 4, icon: LucideIcon, title: () => string) {
  return {
    id: `heading${level}`,
    title,
    keywords: ["标题", "heading", `h${level}`, "title"],
    icon,
    run: (context) =>
      replaceWith(context, (chain) => chain.setHeading({ level })),
  } satisfies SlashMenuItem;
}

/**
 * The slash menu's items, in menu order. Add an item by adding an entry here.
 */
export const SLASH_MENU_ITEMS: ReadonlyArray<SlashMenuItem> = [
  {
    id: "paragraph",
    title: m.editor_slash_paragraph,
    keywords: ["正文", "段落", "text", "paragraph"],
    icon: Pilcrow,
    run: (context) => replaceWith(context, (chain) => chain.setParagraph()),
  },
  heading(2, Heading2, m.editor_slash_heading2),
  heading(3, Heading3, m.editor_slash_heading3),
  heading(4, Heading4, m.editor_slash_heading4),
  {
    id: "bulletList",
    title: m.editor_slash_bullet_list,
    keywords: ["无序列表", "列表", "bullet", "list", "ul"],
    icon: List,
    run: (context) => replaceWith(context, (chain) => chain.toggleBulletList()),
  },
  {
    id: "orderedList",
    title: m.editor_slash_ordered_list,
    keywords: ["有序列表", "列表", "numbered", "ordered", "list", "ol"],
    icon: ListOrdered,
    run: (context) =>
      replaceWith(context, (chain) => chain.toggleOrderedList()),
  },
  {
    id: "blockquote",
    title: m.editor_slash_blockquote,
    keywords: ["引用", "quote", "blockquote"],
    icon: Quote,
    run: (context) => replaceWith(context, (chain) => chain.setBlockquote()),
  },
  {
    id: "codeBlock",
    title: m.editor_slash_code_block,
    keywords: ["代码块", "代码", "code", "codeblock"],
    icon: Code,
    run: (context) => replaceWith(context, (chain) => chain.setCodeBlock()),
  },
  {
    id: "mermaid",
    title: m.editor_slash_mermaid,
    keywords: [
      "图表",
      "流程图",
      "时序图",
      "mermaid",
      "diagram",
      "chart",
      "flowchart",
    ],
    icon: Workflow,
    run: (context) =>
      replaceWith(context, (chain) =>
        chain.setCodeBlock({ language: MERMAID }),
      ),
  },
  {
    id: "table",
    title: m.editor_slash_table,
    keywords: ["表格", "table"],
    icon: TableIcon,
    run: (context) =>
      replaceWith(context, (chain) =>
        chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }),
      ),
  },
  {
    id: "horizontalRule",
    title: m.editor_slash_divider,
    keywords: ["分隔线", "分割线", "divider", "horizontal rule", "hr"],
    icon: Minus,
    run: (context) =>
      replaceWith(context, (chain) => chain.setHorizontalRule()),
  },
  {
    id: "blockMath",
    title: m.editor_slash_block_math,
    keywords: ["块级公式", "公式", "数学", "math", "formula", "latex"],
    icon: SquareFunction,
    // No focus command: it would take focus back from the formula's input.
    run: ({ editor, range }) =>
      editor.chain().deleteRange(range).insertMath("block").run(),
  },
  {
    id: "image",
    title: m.editor_slash_image,
    keywords: ["图片", "image", "picture", "photo"],
    icon: ImageIcon,
    // Focusing here would pull focus back from the image picker.
    run: ({ editor, range }) =>
      editor.chain().deleteRange(range).insertImagePlaceholder().run(),
  },
  {
    id: "video",
    title: m.editor_slash_video,
    keywords: [
      "视频",
      "video",
      "bilibili",
      "b站",
      "哔哩哔哩",
      "youtube",
      "embed",
    ],
    icon: Video,
    // No focus command: it would take focus back from the link input.
    run: ({ editor, range }) =>
      editor.chain().deleteRange(range).insertVideo().run(),
  },
];

/**
 * Items whose name or keywords contain `query`, ignoring case and surrounding
 * spaces, in menu order. An empty query keeps every item.
 */
export function filterSlashMenuItems(
  items: ReadonlyArray<SlashMenuItem>,
  query: string,
): Array<SlashMenuItem> {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...items];
  return items.filter((item) =>
    [item.title(), ...item.keywords].some((term) =>
      term.toLowerCase().includes(needle),
    ),
  );
}
