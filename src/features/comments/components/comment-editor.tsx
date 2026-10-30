import { Send } from "lucide-react";
import {
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { StatusText } from "@/components/ui/status-text";
import { m } from "@/paraglide/messages";
import { CommentEditorActive } from "./comment-reveal";

interface CommentEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (content: string) => Promise<void>;
  isSubmitting?: boolean;
  challengePending?: boolean;
  autoFocus?: boolean;
  onCancel?: () => void;
  submitLabel?: string;
  label?: string;
  challenge?: ReactNode;
}
export function CommentEditor({
  value,
  onChange,
  onSubmit,
  isSubmitting,
  challengePending,
  autoFocus,
  onCancel,
  submitLabel,
  label,
  challenge,
}: CommentEditorProps) {
  const active = useContext(CommentEditorActive);
  const id = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const submitting = useRef(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (active && autoFocus) inputRef.current?.focus({ preventScroll: true });
  }, [active, autoFocus]);
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !value.trim() ||
      isSubmitting ||
      submitting.current ||
      challengePending ||
      !active
    )
      return;
    submitting.current = true;
    setError(false);
    try {
      await onSubmit(value.trim());
    } catch {
      setError(true);
    } finally {
      submitting.current = false;
    }
  };
  return (
    <form className="comment-composer" onSubmit={handleSubmit}>
      {label && (
        <label className="comment-composer-target" htmlFor={id}>
          {label}
        </label>
      )}
      <div className="comment-composer-input">
        <textarea
          ref={inputRef}
          id={id}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setError(false);
          }}
          disabled={isSubmitting || !active}
          aria-label={label || m.comments_editor_placeholder()}
          placeholder={m.comments_editor_placeholder()}
          rows={3}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      </div>
      <div className="comment-composer-footer">
        <div className="comment-challenge">{active ? challenge : null}</div>
        <div className="comment-composer-actions">
          {onCancel && (
            <Button
              variant="plain"
              size="sm"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              {m.comments_editor_cancel()}
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={!value.trim() || challengePending || !active}
            loading={isSubmitting}
            icon={<Send size={15} />}
          >
            {submitLabel || m.comments_editor_submit()}
          </Button>
        </div>
      </div>
      {error && (
        <StatusText error id={`${id}-error`} className="comment-error">
          {m.comments_send_failed_keep_draft()}
        </StatusText>
      )}
    </form>
  );
}
