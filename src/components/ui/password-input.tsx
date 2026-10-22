import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import "./field.css";

/** Whether this browser can mask a text field, so it need not be a password. */
function canMaskText() {
  return (
    typeof CSS !== "undefined" && CSS.supports("-webkit-text-security", "disc")
  );
}

/** Fields that tell password managers to leave them alone. */
const NOT_A_LOGIN = {
  autoComplete: "off",
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-bwignore": true,
  "data-form-type": "other",
} as const;

/**
 * A masked `Input` with one theme-aware reveal button, in place of the
 * browser's own (Edge draws a second one).
 *
 * `secret` is for credentials that are not the user's login, such as an
 * SMTP password or a bot token: password managers neither offer saved
 * logins for it nor save it.
 */
export function PasswordInput({
  className,
  secret = false,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { secret?: boolean }) {
  const [visible, setVisible] = useState(false);
  const masked = !visible && secret && canMaskText();
  return (
    <div className="fuwari-password-input">
      <input
        {...(secret ? NOT_A_LOGIN : {})}
        {...props}
        className={cn("fuwari-input", className)}
        type={visible || masked ? "text" : "password"}
        data-masked={masked || undefined}
        spellCheck={false}
      />
      <button
        type="button"
        className="fuwari-field-button"
        disabled={props.disabled}
        aria-label={visible ? m.login_hide_password() : m.login_show_password()}
        aria-pressed={visible}
        aria-controls={props.id}
        onClick={() => setVisible((value) => !value)}
      >
        {visible ? (
          <EyeOff size={18} aria-hidden="true" />
        ) : (
          <Eye size={18} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
