import { Extension } from "@tiptap/core";
import { Fragment, Slice } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { getPastedMarkdown, parsePastedMarkdown } from "./parse-markdown";

export interface MarkdownPasteOptions {
  /** Called with the number of local-path images kept as text. */
  onLocalImages?: (count: number) => void;
}

/** Pastes plain-text Markdown as formatted content. */
export const MarkdownPaste = Extension.create<MarkdownPasteOptions>({
  name: "markdownPaste",

  // Runs before CodeBlock's handler, which turns every VS Code paste into a
  // code block.
  priority: 200,

  addOptions() {
    return {
      onLocalImages: undefined,
    };
  },

  addProseMirrorPlugins() {
    const { onLocalImages } = this.options;
    let plainTextShortcut = false;

    return [
      new Plugin({
        key: new PluginKey("markdownPaste"),
        props: {
          handleDOMEvents: {
            keydown: (_view, event) => {
              plainTextShortcut =
                event.shiftKey &&
                (event.ctrlKey || event.metaKey) &&
                event.key.toLowerCase() === "v";
              return false;
            },
          },
          handlePaste: (view, event) => {
            const plainText = plainTextShortcut;
            plainTextShortcut = false;

            const markdown = getPastedMarkdown(event.clipboardData, {
              inCode: !!view.state.selection.$from.parent.type.spec.code,
              plainText,
            });
            if (markdown === null) return false;

            const { content, localImageCount } = parsePastedMarkdown(markdown);
            let fragment: Fragment;
            try {
              const nodes = content.map((node) =>
                view.state.schema.nodeFromJSON(node),
              );
              for (const node of nodes) node.check();
              fragment = Fragment.fromArray(nodes);
            } catch {
              return false;
            }
            if (fragment.size === 0) return false;

            // Open like a clipboard slice, so a single paragraph joins the
            // paragraph at the cursor.
            view.dispatch(
              view.state.tr
                .replaceSelection(Slice.maxOpen(fragment))
                .scrollIntoView()
                .setMeta("paste", true)
                .setMeta("uiEvent", "paste"),
            );
            if (localImageCount > 0) onLocalImages?.(localImageCount);
            return true;
          },
        },
      }),
    ];
  },
});
