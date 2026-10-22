import type { Editor } from "@tiptap/react";
import { Table as TableIcon } from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { FloatingPopover } from "@/components/ui/floating-popover";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { ToolbarButton } from "./toolbar-button";

/** The largest table the picker offers, in columns and in rows. */
const MAX_SIZE = 8;
const CELL = 20;
const GAP = 4;

interface TableSize {
  cols: number;
  rows: number;
}

const SMALLEST: TableSize = { cols: 1, rows: 1 };
const INDICES = Array.from({ length: MAX_SIZE }, (_, index) => index + 1);

const ARROW_STEPS: Record<string, TableSize | undefined> = {
  ArrowRight: { cols: 1, rows: 0 },
  ArrowLeft: { cols: -1, rows: 0 },
  ArrowDown: { cols: 0, rows: 1 },
  ArrowUp: { cols: 0, rows: -1 },
};

function clamp(value: number) {
  return Math.min(MAX_SIZE, Math.max(1, value));
}

/**
 * The toolbar's table button and its size picker: a grid of up to 8 × 8 cells
 * where hovering or the arrow keys highlight a size and a click or Enter
 * inserts a table of that size with a header row. Focus sits on the grid
 * while it is open; Escape closes it and returns focus to the button.
 */
export function TableSizePicker({
  editor,
  isActive,
}: {
  editor: Editor | null;
  isActive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState(SMALLEST);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const gridId = useId();
  const cellId = ({ cols, rows }: TableSize) => `${gridId}-${rows}-${cols}`;

  const openPicker = () => {
    if (!editor?.isEditable) return;
    setSize(SMALLEST);
    setOpen(true);
  };

  const insert = ({ cols, rows }: TableSize) => {
    setOpen(false);
    editor
      ?.chain()
      .focus()
      .insertTable({ cols, rows, withHeaderRow: true })
      .run();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = ARROW_STEPS[event.key];
    if (step) {
      event.preventDefault();
      setSize((current) => ({
        cols: clamp(current.cols + step.cols),
        rows: clamp(current.rows + step.rows),
      }));
      return;
    }
    switch (event.key) {
      case "Enter":
      case " ":
        event.preventDefault();
        insert(size);
        return;
      case "Tab":
        setOpen(false);
    }
  };

  return (
    <>
      <ToolbarButton
        ref={triggerRef}
        onClick={() => (open ? setOpen(false) : openPicker())}
        isActive={isActive}
        icon={TableIcon}
        label={m.editor_toolbar_table()}
        aria-pressed={undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
      />

      <FloatingPopover
        open={open}
        anchor={open ? triggerRef.current : null}
        onDismiss={() => setOpen(false)}
        returnFocusOnEscape
        placement="bottom-end"
        initialFocus={() => gridRef.current}
        role="dialog"
        aria-label={m.editor_toolbar_table()}
        className="flex flex-col gap-2 p-2"
      >
        <div
          ref={gridRef}
          role="grid"
          tabIndex={0}
          aria-label={m.editor_toolbar_table()}
          aria-activedescendant={cellId(size)}
          onKeyDown={handleKeyDown}
          className="flex flex-col rounded-sm outline-none"
          style={{ gap: GAP }}
        >
          {INDICES.map((rows) => (
            <div key={rows} role="row" className="flex" style={{ gap: GAP }}>
              {INDICES.map((cols) => {
                const highlighted = cols <= size.cols && rows <= size.rows;
                return (
                  <div
                    key={cols}
                    id={cellId({ cols, rows })}
                    role="gridcell"
                    aria-label={m.editor_toolbar_table_size({
                      cols,
                      rows,
                    })}
                    aria-selected={highlighted}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setSize({ cols, rows })}
                    onClick={() => insert({ cols, rows })}
                    style={{ width: CELL, height: CELL }}
                    className={cn(
                      "shrink-0 cursor-pointer rounded-sm ring-1 transition-colors",
                      highlighted
                        ? "bg-(--fuwari-primary)/20 ring-(--fuwari-primary)/60"
                        : "ring-(--fuwari-input-border)",
                    )}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <p
          aria-live="polite"
          className="text-center font-mono text-xs fuwari-text-75"
        >
          {size.cols} × {size.rows}
        </p>
      </FloatingPopover>
    </>
  );
}
