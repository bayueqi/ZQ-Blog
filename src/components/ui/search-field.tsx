import { Search, X } from "lucide-react";
import { useRef, type ComponentProps, type Ref } from "react";
import "./field.css";

/**
 * A search box: icon, input, and a clear button while there is a query.
 * `lg` is the public search page's headline field.
 */
export function SearchField({
  ref,
  value,
  onValueChange,
  clearLabel,
  onClear,
  size = "md",
  className,
  ...props
}: Omit<ComponentProps<"input">, "value" | "onChange" | "size" | "ref"> & {
  ref?: Ref<HTMLInputElement>;
  value: string;
  onValueChange: (value: string) => void;
  clearLabel: string;
  /** Runs after the query is cleared; focus has returned to the input. */
  onClear?: () => void;
  size?: "md" | "lg";
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div
      role="search"
      className={["fuwari-field-shell", className].filter(Boolean).join(" ")}
      data-size={size}
    >
      <Search size={size === "lg" ? 20 : 17} strokeWidth={1.75} aria-hidden />
      <input
        {...props}
        ref={(node) => {
          inputRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      />
      {value ? (
        <button
          type="button"
          className="fuwari-field-button"
          aria-label={clearLabel}
          onClick={() => {
            onValueChange("");
            inputRef.current?.focus();
            onClear?.();
          }}
        >
          <X size={size === "lg" ? 18 : 16} />
        </button>
      ) : null}
    </div>
  );
}
