import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import "./field.css";

/** The Fuwari text field. Size it through `--fuwari-field-*` on a parent. */
export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn("fuwari-input", className)} {...props} />;
}

/** A multi-line `Input`; `mono` for code and templates. */
export function Textarea({
  className,
  mono = false,
  ...props
}: ComponentProps<"textarea"> & { mono?: boolean }) {
  return (
    <textarea
      className={cn("fuwari-input", className)}
      data-mono={mono || undefined}
      {...props}
    />
  );
}
