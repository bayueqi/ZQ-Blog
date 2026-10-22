import { cloneElement, useId, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./field.css";

interface ControlProps {
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "aria-required"?: boolean;
}

/**
 * A label, its control, a hint and an error, wired together: the control
 * gets the label's id, `aria-invalid`, `aria-required` and
 * `aria-describedby` for the hint and error.
 */
export function FormField({
  label,
  hint,
  error,
  required = false,
  optional,
  action,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  /** Text shown after the label for a field that may stay empty. */
  optional?: string;
  /** Beside the label, such as a "forgot password" link. */
  action?: ReactNode;
  className?: string;
  children: ReactElement<ControlProps>;
}) {
  const id = useId();
  const describedBy =
    [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") ||
    undefined;
  return (
    <div className={cn("fuwari-form-field", className)}>
      <div className="fuwari-form-field-label">
        <label htmlFor={id}>
          {label}
          {required ? <abbr aria-hidden="true">*</abbr> : null}
          {optional ? <small>{optional}</small> : null}
        </label>
        {action}
      </div>
      {cloneElement(children, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-required": required || undefined,
        "aria-describedby": describedBy,
      })}
      {hint ? (
        <div id={`${id}-hint`} className="fuwari-form-field-hint">
          {hint}
        </div>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="fuwari-form-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
