import { Check, ChevronDown, Search } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { FloatingPopover } from "@/components/ui/floating-popover";
import { ListboxOption } from "@/components/ui/listbox-option";
import { POPOVER_TRIGGER_CLASS } from "@/components/ui/use-anchored-popover";
import {
  CODE_LANGUAGES,
  PLAIN_TEXT,
  PLAIN_TEXT_ALIASES,
  isPlainTextLanguage,
  resolveCodeLanguage,
} from "@/lib/code-languages";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { filterLanguageOptions, type LanguageOption } from "./language-options";

const POPOVER_MAX_HEIGHT = 320;

function pickerOptions(): Array<LanguageOption> {
  return [
    ...CODE_LANGUAGES,
    {
      id: PLAIN_TEXT,
      label: m.common_plain_text(),
      aliases: PLAIN_TEXT_ALIASES,
    },
  ];
}

/**
 * The code block's language picker: a trigger showing the current language
 * and a popover with a search box over a filtered list. Focus stays in the
 * search box; arrows move the active option, Enter picks it, Escape closes.
 */
export function LanguagePicker({
  value,
  onChange,
}: {
  /** The block's language as stored; aliases are shown as their language. */
  value: string;
  onChange: (id: string) => void;
}) {
  const options = useMemo(pickerOptions, []);
  const currentId = isPlainTextLanguage(value)
    ? PLAIN_TEXT
    : (resolveCodeLanguage(value)?.id ?? value);
  const currentLabel =
    options.find((option) => option.id === currentId)?.label ?? value;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  // Set when the active option moves by keyboard, typing or opening, so it is
  // scrolled into view; a hover or a scroll of the list leaves the list alone.
  const revealActive = useRef(false);
  const listId = useId();
  const optionId = (id: string) => `${listId}-${id}`;

  const filtered = useMemo(
    () => filterLanguageOptions(options, query),
    [options, query],
  );
  const active = filtered[activeIndex];

  const openPicker = () => {
    setQuery("");
    revealActive.current = true;
    setActiveIndex(
      Math.max(
        0,
        options.findIndex((option) => option.id === currentId),
      ),
    );
    setOpen(true);
  };

  const pick = (option: LanguageOption) => {
    onChange(option.id);
    setOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open || !active || !revealActive.current) return;
    revealActive.current = false;
    document
      .getElementById(optionId(active.id))
      ?.scrollIntoView?.({ block: "nearest" });
  });

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        if (filtered.length === 0) return;
        const step = event.key === "ArrowDown" ? 1 : -1;
        revealActive.current = true;
        setActiveIndex(
          (current) => (current + step + filtered.length) % filtered.length,
        );
        return;
      }
      case "Enter":
        event.preventDefault();
        if (active) pick(active);
        return;
      case "Tab":
        setOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={m.editor_code_language()}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openPicker())}
        className={POPOVER_TRIGGER_CLASS}
      >
        <span>{currentLabel}</span>
        <ChevronDown
          size={12}
          aria-hidden="true"
          className={cn(
            "transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      <FloatingPopover
        open={open}
        anchor={open ? triggerRef.current : null}
        onDismiss={() => setOpen(false)}
        returnFocusOnEscape
        placement="bottom-end"
        maxHeight={POPOVER_MAX_HEIGHT}
        initialFocus={() => searchRef.current}
        className="flex w-52 flex-col overflow-hidden"
      >
        <div className="flex items-center gap-2 border-b border-(--fuwari-input-border) px-3 py-2 fuwari-text-50 focus-within:text-(--fuwari-primary)">
          <Search size={14} aria-hidden="true" className="shrink-0" />
          <input
            ref={searchRef}
            type="text"
            role="combobox"
            aria-label={m.editor_code_language_search()}
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active ? optionId(active.id) : undefined}
            placeholder={m.editor_code_language_search()}
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              revealActive.current = true;
              setActiveIndex(0);
            }}
            onKeyDown={handleSearchKeyDown}
            className="min-w-0 flex-1 bg-transparent text-sm fuwari-text-90 outline-none placeholder:text-(--fuwari-fg-30)"
          />
        </div>
        <div
          id={listId}
          role="listbox"
          aria-label={m.editor_code_language()}
          className="max-h-64 min-h-0 overflow-y-auto p-1 empty:hidden custom-scrollbar"
        >
          {filtered.map((option, index) => {
            const isActive = index === activeIndex;
            const isCurrent = option.id === currentId;
            return (
              <ListboxOption
                key={option.id}
                id={optionId(option.id)}
                active={isActive}
                current={isCurrent}
                onActivate={() => setActiveIndex(index)}
                onPick={() => pick(option)}
                className="justify-between gap-2 px-3"
              >
                <span className="truncate">{option.label}</span>
                {isCurrent ? (
                  <Check
                    size={14}
                    strokeWidth={2.5}
                    aria-hidden="true"
                    className="shrink-0"
                  />
                ) : null}
              </ListboxOption>
            );
          })}
        </div>
        {filtered.length === 0 ? (
          <p className="px-4 py-2.5 text-sm fuwari-text-50">
            {m.editor_code_language_empty()}
          </p>
        ) : null}
      </FloatingPopover>
    </div>
  );
}
