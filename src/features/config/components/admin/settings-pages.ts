export const SETTINGS_PAGE_TO = {
  site: "/admin/settings/site",
  notify: "/admin/settings/notifications",
  "api-keys": "/admin/settings/api-keys",
  "muted-users": "/admin/settings/muted-users",
  maintenance: "/admin/settings/maintenance",
} as const;

export type SettingsPageId = keyof typeof SETTINGS_PAGE_TO;

export const SETTINGS_PAGE_IDS = [
  "site",
  "notify",
  "api-keys",
  "muted-users",
  "maintenance",
] as const satisfies ReadonlyArray<SettingsPageId>;

export const LEGACY_SETTINGS_TAB_TO = {
  site: SETTINGS_PAGE_TO.site,
  email: SETTINGS_PAGE_TO.notify,
  webhook: SETTINGS_PAGE_TO.notify,
  "api-keys": SETTINGS_PAGE_TO["api-keys"],
  maintenance: SETTINGS_PAGE_TO.maintenance,
} as const;

export function settingsSectionFromPath(
  pathname: string,
): SettingsPageId | null {
  const path = pathname.replace(/\/+$/, "");
  if (path.endsWith("/settings/site")) return "site";
  if (path.endsWith("/settings/notifications")) return "notify";
  if (path.endsWith("/settings/api-keys")) return "api-keys";
  if (path.endsWith("/settings/muted-users")) return "muted-users";
  if (path.endsWith("/settings/maintenance")) return "maintenance";
  return null;
}
