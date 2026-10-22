import { Link } from "@tanstack/react-router";
import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import type { useForgotPasswordForm } from "../hooks/use-forgot-password-form";
import { AuthHeading, AuthStatus } from "./auth-elements";
import { Callout } from "@/components/ui/callout";
import { m } from "@/paraglide/messages";

export function ForgotPasswordPage({
  forgotPasswordForm: form,
  turnstileElement,
}: {
  forgotPasswordForm: ReturnType<typeof useForgotPasswordForm>;
  turnstileElement: ReactNode;
}) {
  if (form.isSent)
    return (
      <AuthStatus
        state="email"
        title={m.forgot_password_success_title()}
        description={m.forgot_password_success_desc({ email: form.sentEmail })}
      >
        <Link
          to="/login"
          className={buttonClass({
            variant: "primary",
            size: "lg",
            className: "auth-action",
          })}
        >
          {m.forgot_password_back_to_login()}
        </Link>
      </AuthStatus>
    );
  return (
    <div className="auth-page">
      <AuthHeading
        title={m.forgot_password_title()}
        description={m.forgot_password_header_desc()}
      />
      <form className="auth-form" onSubmit={form.handleSubmit} noValidate>
        <FormField
          label={m.forgot_password_email_label()}
          error={form.errors.email?.message}
          required
        >
          <Input
            {...form.register("email")}
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={m.login_email_placeholder()}
            disabled={form.isSubmitting}
          />
        </FormField>
        {form.submitError && (
          <Callout tone="danger" icon={CircleAlert} role="alert">
            {form.submitError}
          </Callout>
        )}
        <div className="auth-verification">{turnstileElement}</div>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="auth-action"
          disabled={form.turnstilePending}
          loading={form.isSubmitting}
        >
          {form.isSubmitting
            ? m.forgot_password_submitting()
            : m.forgot_password_submit()}
        </Button>
      </form>
      <footer className="auth-register">
        <Link to="/login">{m.register_back_to_login()}</Link>
      </footer>
    </div>
  );
}
