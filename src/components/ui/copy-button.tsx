import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { IconButton } from "./icon-button";

const COPIED_MS = 2000;

/** Copies `text` and shows a check, announced to screen readers, for 2s. */
export function CopyButton({
  text,
  label,
  copiedLabel,
  className,
}: {
  text: string;
  label: string;
  copiedLabel: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), COPIED_MS);
    });
  };

  return (
    <>
      <IconButton
        label={label}
        onClick={copy}
        className={cn(
          copied && "text-green-500 hover:text-green-500",
          className,
        )}
      >
        {copied ? (
          <Check size={16} strokeWidth={2.5} />
        ) : (
          <Copy size={16} strokeWidth={2.5} />
        )}
      </IconButton>
      <span className="sr-only" aria-live="polite">
        {copied ? copiedLabel : ""}
      </span>
    </>
  );
}

/** The copy button at the top right of a code block. */
export function CodeCopyButton({ code }: { code: string }) {
  return (
    <CopyButton
      text={code}
      label={m.common_copy_code()}
      copiedLabel={m.common_code_copied()}
      className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
    />
  );
}
