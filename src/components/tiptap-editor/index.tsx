import "@fontsource-variable/jetbrains-mono/wght.css";
import "katex/dist/katex.min.css";
import type {
  Extensions,
  JSONContent,
  Editor as TiptapEditor,
} from "@tiptap/react";
import { EditorContent, useEditor } from "@tiptap/react";
import { memo } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EditorOverlays } from "./ui/editor-overlays";
import EditorToolbar from "./ui/editor-toolbar";

interface EditorProps {
  content?: JSONContent | string;
  onUpdate?: (editor: TiptapEditor) => void;
  onCreated?: (editor: TiptapEditor | null) => void;
  extensions: Extensions;
  editable?: boolean;
  className?: string;
  contentClassName?: string;
  documentHeader?: ReactNode;
  documentClassName?: string;
  scrollContainerId?: string;
  toolbarClassName?: string;
}

export const Editor = memo(function Editor({
  content,
  onUpdate,
  onCreated,
  extensions,
  editable = true,
  className,
  contentClassName,
  documentHeader,
  documentClassName,
  scrollContainerId,
  toolbarClassName,
}: EditorProps) {
  const editor = useEditor({
    extensions,
    content,
    editable,
    onCreate: ({ editor: currentEditor }) => {
      onCreated?.(currentEditor);
    },
    onUpdate: ({ editor: currentEditor }) => {
      onUpdate?.(currentEditor);
    },
    onDestroy: () => {
      onCreated?.(null);
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose dark:prose-invert prose-base max-w-none! fuwari-custom-md focus:outline-none min-h-[500px]",
          !editable && "min-h-0",
          contentClassName,
        ),
      },
    },
    immediatelyRender: false,
  });

  return (
    <div className={cn("relative flex flex-col group", className)}>
      {editable && (
        <EditorToolbar
          editor={editor}
          className={toolbarClassName}
          onLinkClick={() => editor?.commands.openLinkEditor()}
          onImageClick={() => editor?.commands.insertImagePlaceholder()}
          onVideoClick={() => editor?.commands.insertVideo()}
          onFormulaInlineClick={() => editor?.commands.insertMath("inline")}
          onFormulaBlockClick={() => editor?.commands.insertMath("block")}
        />
      )}

      {editable && <EditorOverlays editor={editor} />}

      <div
        id={scrollContainerId}
        className={cn("relative", documentClassName ?? "min-h-125")}
      >
        {documentHeader}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
});
