import type { Editor } from "@tiptap/core";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import {
  FloatingPopover,
  virtualAnchor,
} from "@/components/ui/floating-popover";
import { ListboxOption } from "@/components/ui/listbox-option";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import type { SlashMenuState } from ".";
import {
  closeSlashMenu,
  getSlashMenu,
  highlightSlashMenuItem,
  pickSlashMenuItem,
  subscribeSlashMenu,
} from ".";

/**
 * The slash menu's popover. It lists the items the typed `/query` matches,
 * anchored below the typed text (above it when there is no room). Focus stays
 * in the editor: the extension handles the keys, and a click inserts an item.
 */
export function SlashMenuView({ editor }: { editor: Editor | null }) {
  const subscribe = useCallback(
    (listener: () => void) =>
      editor ? subscribeSlashMenu(editor, listener) : () => {},
    [editor],
  );
  const menu = useSyncExternalStore(
    subscribe,
    () => (editor ? getSlashMenu(editor) : null),
    () => null,
  );
  const open = menu !== null && menu.items.length > 0;

  // Keep showing the last items while the menu animates out.
  const lastMenu = useRef<SlashMenuState | null>(null);
  if (open) lastMenu.current = menu;
  const shown = open ? menu : lastMenu.current;

  const clientRect = open ? menu.clientRect : null;
  const anchor = useMemo(
    () =>
      editor && clientRect ? virtualAnchor(clientRect, editor.view.dom) : null,
    [editor, clientRect],
  );

  const listId = useId();
  const optionId = (index: number) => `${listId}-${index}`;
  const activeIndex = shown?.activeIndex ?? 0;

  useEffect(() => {
    if (!open) return;
    document
      .getElementById(optionId(activeIndex))
      ?.scrollIntoView?.({ block: "nearest" });
  });

  if (!editor || !shown) return null;

  return (
    <FloatingPopover
      open={open}
      anchor={anchor}
      // The extension handles Escape; a click in the editor moves the cursor.
      onDismiss={() => closeSlashMenu(editor)}
      ignoreOutside={(target) => editor.view.dom.contains(target)}
      id={listId}
      role="listbox"
      aria-label={m.editor_slash_menu()}
      className="max-h-80 w-56 overflow-y-auto p-1 custom-scrollbar"
    >
      {shown.items.map((item, index) => {
        const Icon = item.icon;
        const isActive = index === activeIndex;
        return (
          <ListboxOption
            key={item.id}
            id={optionId(index)}
            active={isActive}
            onActivate={() => highlightSlashMenuItem(editor, index)}
            onPick={() => pickSlashMenuItem(editor, index)}
            className="gap-3 px-2"
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1 ring-(--fuwari-input-border)",
                isActive ? "text-(--fuwari-primary)" : "fuwari-text-50",
              )}
            >
              <Icon size={14} />
            </span>
            <span className="truncate">{item.title()}</span>
          </ListboxOption>
        );
      })}
    </FloatingPopover>
  );
}
