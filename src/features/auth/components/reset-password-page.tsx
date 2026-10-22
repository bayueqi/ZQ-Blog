import { Link } from "@tanstack/react-router";
import { CircleAlert } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { PasswordInput } from "@/components/ui/password-input";
import type { useResetPasswordForm } from "../hooks/use-reset-password-form";
import { AuthHeading, AuthStatus } from "./auth-elements";
import { Callout } from "@/components/ui/callout";
import { m } from "@/paraglide/messages";

export function ResetPasswordPage({
  resetPasswordForm: form,
  token,
  error,
}: {
  resetPasswordForm: ReturnType<typeof useResetPasswordForm>;
  token: string | undefined;
  error: string | undefined;
}) {
  if (!token || error)
    return (
      <AuthStatus
        state="error"
        title={
          error
            ? m.reset_password_error_expired_title()
            : m.reset_password_error_missing_token()
        }
        description={
          error
            ? m.reset_password_toast_failed_desc()
            : m.reset_password_error_missing_token_desc()
        }
      >
        <Link
          to="/forgot-password"
          className={buttonClass({
            variant: "primary",
            size: "lg",
            className: "auth-action",
          })}
        >
          {m.reset_password_request_new_link()}
        </Link>
        <Link to="/login" className="auth-status-link">
          {m.forgot_password_back_to_login()}
        </Link>
      </AuthStatus>
    );
  if (form.isSuccess)
    return (
      <AuthStatus
        state="success"
        title={m.reset_password_toast_success()}
        description={m.reset_password_toast_success_desc()}
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
        title={m.reset_password_title()}
        description={m.reset_password_header_desc()}
      />
      <form className="auth-form" onSubmit={form.handleSubmit} noValidate>
        <FormField
          label={m.reset_password_new_password()}
          error={form.errors.password?.message}
          required
        >
          <PasswordInput
            {...form.register("password")}
            autoComplete="new-password"
            placeholder={m.login_password_placeholder()}
            disabled={form.isSubmitting}
          />
        </FormField>
        <FormField
          label={m.reset_password_confirm_new_password()}
          error={form.errors.confirmPassword?.message}
          required
        >
          <PasswordInput
            {...form.register("confirmPassword")}
            autoComplete="new-password"
            placeholder={m.login_password_placeholder()}
            disabled={form.isSubmitting}
          />
        </FormField>
        {form.submitError && (
          <Callout
            className="auth-feedback"
            tone="danger"
            icon={CircleAlert}
            role="alert"
            action={
              <Link to="/forgot-password">
                {m.reset_password_request_new_link()}
              </Link>
            }
          >
            {form.submitError}
          </Callout>
        )}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="auth-action"
          loading={form.isSubmitting}
        >
          {form.isSubmitting
            ? m.reset_password_submitting()
            : m.reset_password_submit()}
        </Button>
      </form>
    </div>
  );
}
