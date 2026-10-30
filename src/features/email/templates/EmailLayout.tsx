import { createContext, useContext, type ReactNode } from "react";
import type { Locale } from "@/lib/i18n";
import { emailTheme, type EmailSite, type EmailTheme } from "./email-theme";

const FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif';

const EmailThemeContext = createContext<EmailTheme>(emailTheme(250));

function useEmailTheme() {
  return useContext(EmailThemeContext);
}

interface EmailLayoutProps {
  children: ReactNode;
  locale?: Locale;
  previewText?: string;
  site: EmailSite;
}

/**
 * Fuwari's look in email-safe markup: the page background, a navbar card with
 * the site name, and a white content card. Styles are inline and colors are
 * resolved hex, since email clients drop stylesheets and `oklch()`.
 */
export const EmailLayout = ({
  children,
  locale,
  previewText,
  site,
}: EmailLayoutProps) => {
  const theme = emailTheme(site.primaryHue);
  return (
    <EmailThemeContext.Provider value={theme}>
      <div
        lang={locale}
        style={{
          backgroundColor: theme.pageBg,
          fontFamily: FONT_FAMILY,
          margin: "0",
          padding: "32px 12px",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {previewText && (
          <div
            style={{
              display: "none",
              maxHeight: "0px",
              overflow: "hidden",
            }}
          >
            {previewText}
          </div>
        )}
        <table
          align="center"
          border={0}
          cellPadding="0"
          cellSpacing="0"
          role="presentation"
          width="100%"
          style={{ maxWidth: "560px", margin: "0 auto" }}
        >
          <tbody>
            <tr>
              <td
                style={{
                  backgroundColor: theme.cardBg,
                  borderRadius: "12px",
                  padding: "14px 20px",
                }}
              >
                <span
                  style={{
                    color: theme.primary,
                    fontSize: "17px",
                    fontWeight: 700,
                  }}
                >
                  {site.title}
                </span>
              </td>
            </tr>
            <tr>
              <td style={{ height: "12px", lineHeight: "12px" }}>&nbsp;</td>
            </tr>
            <tr>
              <td
                style={{
                  backgroundColor: theme.cardBg,
                  borderRadius: "16px",
                  padding: "32px 28px",
                  color: theme.body,
                  fontSize: "15px",
                  lineHeight: "1.7",
                }}
              >
                {children}
              </td>
            </tr>
            <tr>
              <td
                style={{
                  padding: "20px 8px 0",
                  textAlign: "center",
                  color: theme.muted,
                  fontSize: "12px",
                }}
              >
                &copy; {new Date().getUTCFullYear()} {site.title}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </EmailThemeContext.Provider>
  );
};

/** A section title with Fuwari's primary accent bar. */
export function EmailHeading({ children }: { children: ReactNode }) {
  const theme = useEmailTheme();
  return (
    <h1
      style={{
        borderLeft: `4px solid ${theme.primary}`,
        paddingLeft: "12px",
        margin: "0 0 20px",
        color: theme.text,
        fontSize: "20px",
        fontWeight: 700,
        lineHeight: "1.4",
      }}
    >
      {children}
    </h1>
  );
}

export function EmailText({ children }: { children: ReactNode }) {
  const theme = useEmailTheme();
  return <p style={{ margin: "0 0 16px", color: theme.body }}>{children}</p>;
}

/** Muted small print, such as expiry notes and follow-ups. */
export function EmailNote({ children }: { children: ReactNode }) {
  const theme = useEmailTheme();
  return (
    <p
      style={{
        margin: "16px 0 0",
        color: theme.muted,
        fontSize: "13px",
        lineHeight: "1.6",
      }}
    >
      {children}
    </p>
  );
}

/** Quoted or listed content on Fuwari's tinted button background. */
export function EmailPanel({ children }: { children: ReactNode }) {
  const theme = useEmailTheme();
  return (
    <div
      style={{
        backgroundColor: theme.regularBg,
        borderRadius: "12px",
        padding: "14px 16px",
        margin: "20px 0",
        color: theme.body,
        fontSize: "14px",
        lineHeight: "1.7",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {children}
    </div>
  );
}

export function EmailButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const theme = useEmailTheme();
  return (
    <div style={{ margin: "28px 0 4px" }}>
      <a
        href={href}
        style={{
          display: "inline-block",
          backgroundColor: theme.primary,
          color: "#ffffff",
          borderRadius: "8px",
          padding: "10px 22px",
          fontSize: "14px",
          fontWeight: 500,
          textDecoration: "none",
        }}
      >
        {children}
      </a>
    </div>
  );
}

export function EmailLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const theme = useEmailTheme();
  return (
    <a href={href} style={{ color: theme.link, wordBreak: "break-all" }}>
      {children}
    </a>
  );
}

/** Separates a footer note, such as the unsubscribe line, from the body. */
export function EmailDivider() {
  const theme = useEmailTheme();
  return (
    <div
      style={{
        borderTop: `1px solid ${theme.divider}`,
        margin: "28px 0 0",
      }}
    />
  );
}
