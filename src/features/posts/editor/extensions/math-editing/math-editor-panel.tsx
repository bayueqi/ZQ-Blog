import katex from "katex";
import type { Ref } from "react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import type { MathType } from "./state";

type Preview = { html: string } | { error: string } | null;

function renderPreview(latex: string, type: MathType): Preview {
  if (!latex.trim()) return null;
  try {
    return {
      html: katex.renderToString(latex, {
        throwOnError: true,
        displayMode: type === "block",
      }),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export interface MathEditorPanelProps {
  /** The LaTeX to start from. */
  latex: string;
  /** How the formula is shown now. */
  type: MathType;
  onApply: (latex: string, type: MathType) => void;
  onCancel: () => void;
  inputRef?: Ref<HTMLTextAreaElement>;
  className?: string;
}

/**
 * Edits a formula: a LaTeX input with a live KaTeX preview that shows LaTeX
 * errors, and an inline/block switch. Ctrl/Cmd+Enter applies, Escape
 * cancels.
 */
export function MathEditorPanel({
  latex,
  type,
  onApply,
  onCancel,
  inputRef,
  className,
}: MathEditorPanelProps) {
  const [value, setValue] = useState(latex);
  const [shownAs, setShownAs] = useState(type);
  const preview = useMemo(
    () => renderPreview(value, shownAs),
    [value, shownAs],
  );
  const apply = () => onApply(value, shownAs);

  return (
    <div
      data-math-editor=""
      className={cn(
        "flex flex-col gap-2 text-left [--fuwari-field-font-size:13px] [--fuwari-field-height:36px] [--fuwari-field-radius:8px]",
        className,
      )}
    >
      <Textarea
        mono
        ref={inputRef}
        aria-label="LaTeX"
        value={value}
        rows={3}
        spellCheck={false}
        placeholder={m.editor_formula_placeholder()}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Escape") {
            // Handled here, so an enclosing popover does not close again.
            event.preventDefault();
            onCancel();
          } else if (
            event.key === "Enter" &&
            (event.ctrlKey || event.metaKey)
          ) {
            event.preventDefault();
            apply();
          }
        }}
      />
      <output
        aria-label={m.editor_formula_preview()}
        className={cn(
          "flex min-h-12 items-center justify-center overflow-x-auto rounded-lg p-2",
          preview && "error" in preview
            ? "bg-(--fuwari-danger-bg)"
            : "bg-(--fuwari-input-bg)",
        )}
      >
        {preview === null ? (
          <span className="text-sm fuwari-text-30">
            {m.editor_formula_preview_empty()}
          </span>
        ) : "error" in preview ? (
          <span className="fuwari-form-field-error wrap-break-word">
            {preview.error}
          </span>
        ) : (
          <span
            className="max-w-full fuwari-text-90"
            dangerouslySetInnerHTML={{ __html: preview.html }}
          />
        )}
      </output>
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          aria-label={m.editor_formula_display()}
          track={false}
          size="sm"
          value={shownAs}
          onValueChange={setShownAs}
          items={[
            { value: "inline", label: m.editor_formula_inline() },
            { value: "block", label: m.editor_formula_block() },
          ]}
        />
        <span className="mr-auto hidden text-xs fuwari-text-50 sm:inline">
          {m.editor_formula_shortcut()}
        </span>
        <Button size="sm" onClick={onCancel}>
          {m.editor_formula_cancel()}
        </Button>
        <Button variant="primary" size="sm" onClick={apply}>
          {m.editor_formula_apply()}
        </Button>
      </div>
    </div>
  );
}
