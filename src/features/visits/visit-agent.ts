export const VISIT_BROWSERS = [
  "Edge",
  "Chrome",
  "Safari",
  "Firefox",
  "Opera",
  "Other",
] as const;

export const VISIT_DEVICES = ["desktop", "mobile", "tablet", "other"] as const;

export const VISIT_OSES = [
  "Windows",
  "macOS",
  "iOS",
  "Android",
  "Linux",
  "Other",
] as const;

export type VisitBrowser = (typeof VISIT_BROWSERS)[number];
export type VisitDevice = (typeof VISIT_DEVICES)[number];
export type VisitOs = (typeof VISIT_OSES)[number];

// 爬虫、预渲染、命令行工具都不算访客。
const BOT_PATTERN =
  /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor|uptime|curl\/|wget\/|python-requests|go-http-client|okhttp|axios\//i;

export function isVisitor(userAgent: string | null) {
  return (
    userAgent !== null &&
    userAgent.trim() !== "" &&
    !BOT_PATTERN.test(userAgent)
  );
}

/** 只认大类和常见系统，认不出就算 Other。 */
export function parseUserAgent(userAgent: string): {
  browser: VisitBrowser;
  device: VisitDevice;
  os: VisitOs;
} {
  const browser: VisitBrowser = /Edg[A-Z]?\//.test(userAgent)
    ? "Edge"
    : /OPR\/|Opera/.test(userAgent)
      ? "Opera"
      : /Firefox\/|FxiOS\//.test(userAgent)
        ? "Firefox"
        : /Chrome\/|CriOS\//.test(userAgent)
          ? "Chrome"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "Other";

  const device: VisitDevice =
    /iPad|Tablet/i.test(userAgent) ||
    (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent))
      ? "tablet"
      : /Mobi|iPhone|Android/i.test(userAgent)
        ? "mobile"
        : /Windows|Macintosh|Linux|X11/i.test(userAgent)
          ? "desktop"
          : "other";

  // iOS 的 UA 里也有 "Mac OS X"，所以先判 iPhone / iPad。
  const os: VisitOs = /Windows NT/i.test(userAgent)
    ? "Windows"
    : /iPhone|iPad|iPod/i.test(userAgent)
      ? "iOS"
      : /Mac OS X|Macintosh/i.test(userAgent)
        ? "macOS"
        : /Android/i.test(userAgent)
          ? "Android"
          : /Linux|X11|CrOS/i.test(userAgent)
            ? "Linux"
            : "Other";

  return { browser, device, os };
}
