import { Link } from "@tanstack/react-router";
import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import type { useRegisterForm } from "../hooks/use-register-form";
import { AuthHeading, AuthStatus } from "./auth-elements";
import { Callout } from "@/components/ui/callout";
import { m } from "@/paraglide/messages";

export function RegisterPage({
  registerForm: form,
  turnstileElement,
}: {
  isEmailConfigured: boolean;
  registerForm: ReturnType<typeof useRegisterForm>;
  turnstileElement: ReactNode;
}) {
  if (form.isSuccess)
    return (
      <AuthStatus
        state="email"
        title={m.register_success_title()}
        description={m.register_success_desc()}
      >
        <Link
          to="/login"
          className={buttonClass({
            variant: "primary",
            size: "lg",
            className: "auth-action",
          })}
        >
          {m.register_back_to_login()}
        </Link>
      </AuthStatus>
    );
  return (
    <div className="auth-page">
      <AuthHeading
        title={m.register_header_title()}
        description={m.register_header_desc()}
      />
      <form className="auth-form" onSubmit={form.handleSubmit} noValidate>
        <fieldset disabled={form.isSubmitting}>
          <FormField
            label={m.register_nickname()}
            error={form.errors.name?.message}
            required
          >
            <Input
              {...form.register("name")}
              autoComplete="nickname"
              maxLength={20}
              placeholder={m.register_nickname_placeholder()}
            />
          </FormField>
          <FormField
            label={m.login_email_address()}
            error={form.errors.email?.message}
            required
          >
            <Input
              {...form.register("email")}
              type="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={m.login_email_placeholder()}
            />
          </FormField>
          <FormField
            label={m.register_password()}
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
            label={m.register_confirm_password()}
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
        </fieldset>
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
          {form.isSubmitting ? m.register_submitting() : m.register_submit()}
        </Button>
      </form>
      <footer className="auth-register">
        {m.register_have_account()}{" "}
        <Link to="/login">{m.register_go_to_login()}</Link>
      </footer>
    </div>
  );
}
