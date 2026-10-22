import type { Editor } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import type { SuggestionProps } from "@tiptap/suggestion";
import { exitSuggestion, Suggestion } from "@tiptap/suggestion";
import type { SlashMenuItem } from "./items";
import { filterSlashMenuItems, SLASH_MENU_ITEMS } from "./items";

/** What the open slash menu shows. */
export interface SlashMenuState {
  /** The text typed after `/`. */
  query: string;
  items: ReadonlyArray<SlashMenuItem>;
  activeIndex: number;
  /** Where the typed `/query` is on screen, or `null` once it is gone. */
  clientRect: () => DOMRect | null;
}

interface SlashMenuStorage {
  menu: SlashMenuState | null;
  pick: ((item: SlashMenuItem) => void) | null;
  listeners: Set<() => void>;
}

declare module "@tiptap/core" {
  interface Storage {
    slashMenu: SlashMenuStorage;
  }
}

const slashMenuKey = new PluginKey("slashMenu");

// Whitespace a `/` may follow; a `/` at the start of a text block always opens
// the menu.
const ALLOWED_PREFIXES = [" ", " ", "　", "\t"];

function storageOf(editor: Editor): SlashMenuStorage | undefined {
  return editor.storage.slashMenu as SlashMenuStorage | undefined;
}

function setMenu(storage: SlashMenuStorage, menu: SlashMenuState | null) {
  storage.menu = menu;
  for (const listener of storage.listeners) listener();
}

/**
 * The block menu that typing `/` at the start of a line or after whitespace
 * opens. Typing on filters it, arrows move the active item, Enter inserts it
 * in place of the typed text and Escape closes the menu. It never opens in a
 * code block or a read-only editor. The `Editor` component renders it.
 */
export const SlashMenu = Extension.create<
  Record<string, never>,
  SlashMenuStorage
>({
  name: "slashMenu",

  addStorage() {
    return { menu: null, pick: null, listeners: new Set() };
  },

  addProseMirrorPlugins() {
    const { editor, storage } = this;

    const show = (props: SuggestionProps<SlashMenuItem, SlashMenuItem>) => {
      const items = filterSlashMenuItems(SLASH_MENU_ITEMS, props.query);
      const previous = storage.menu;
      storage.pick = props.command;
      setMenu(storage, {
        query: props.query,
        items,
        activeIndex: previous?.query === props.query ? previous.activeIndex : 0,
        // The first rect follows the typed text for the menu's lifetime.
        clientRect: previous?.clientRect ?? props.clientRect ?? (() => null),
      });
    };

    const move = (step: number) => {
      const menu = storage.menu;
      if (!menu || menu.items.length === 0) return;
      const count = menu.items.length;
      setMenu(storage, {
        ...menu,
        activeIndex: (menu.activeIndex + step + count) % count,
      });
    };

    return [
      Suggestion<SlashMenuItem, SlashMenuItem>({
        editor,
        pluginKey: slashMenuKey,
        char: "/",
        allowedPrefixes: ALLOWED_PREFIXES,
        allow: ({ state, range }) =>
          !state.doc.resolve(range.from).parent.type.spec.code,
        command: ({ editor: target, range, props: item }) =>
          item.run({ editor: target, range }),
        render: () => ({
          onStart: (props) => {
            storage.menu = null;
            show(props);
          },
          onUpdate: show,
          onExit: () => {
            storage.pick = null;
            setMenu(storage, null);
          },
          onKeyDown: ({ event }) => {
            const menu = storage.menu;
            if (!menu || menu.items.length === 0) return false;
            switch (event.key) {
              case "ArrowDown":
                move(1);
                return true;
              case "ArrowUp":
                move(-1);
                return true;
              case "Enter": {
                const item = menu.items[menu.activeIndex];
                if (item) storage.pick?.(item);
                return true;
              }
              default:
                return false;
            }
          },
        }),
      }),
    ];
  },
});

/** The open slash menu, or `null` when it is closed. */
export function getSlashMenu(editor: Editor): SlashMenuState | null {
  return storageOf(editor)?.menu ?? null;
}

/** Calls `listener` whenever the slash menu opens, changes or closes. */
export function subscribeSlashMenu(editor: Editor, listener: () => void) {
  const storage = storageOf(editor);
  storage?.listeners.add(listener);
  return () => {
    storage?.listeners.delete(listener);
  };
}

/** Closes the slash menu, as Escape does, leaving the typed text. */
export function closeSlashMenu(editor: Editor) {
  if (getSlashMenu(editor)) exitSuggestion(editor.view, slashMenuKey);
}

/** Makes the item at `index` the active one, as hovering it does. */
export function highlightSlashMenuItem(editor: Editor, index: number) {
  const storage = storageOf(editor);
  const menu = storage?.menu;
  if (!storage || !menu || index === menu.activeIndex) return;
  if (index < 0 || index >= menu.items.length) return;
  setMenu(storage, { ...menu, activeIndex: index });
}

/** Inserts the item at `index`, as clicking it does. */
export function pickSlashMenuItem(editor: Editor, index: number) {
  const storage = storageOf(editor);
  const item = storage?.menu?.items[index];
  if (item) storage.pick?.(item);
}
