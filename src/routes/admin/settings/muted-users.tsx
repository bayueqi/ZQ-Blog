import { createFileRoute } from "@tanstack/react-router";
import { MutedUsersSettingsSection } from "@/features/muted-users/components/muted-users-settings-section";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/admin/settings/muted-users")({
  ssr: false,
  loader: () => ({ title: m.muted_users_title() }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.title }],
  }),
  component: MutedUsersSettingsSection,
});
