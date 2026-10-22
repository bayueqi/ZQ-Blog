import { ClientOnly } from "@tanstack/react-router";
import { Copy, KeyRound, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { FuwariModal } from "@/components/ui/fuwari-modal";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/page-heading";
import { useApiKeys } from "@/features/api-keys/hooks/use-api-keys";
import { formatDate } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import "./api-key-settings.css";

export function ApiKeySettingsSection() {
  const {
    keys,
    isLoading,
    isError,
    reload,
    createKey,
    isCreating,
    deleteKey,
    isDeleting,
  } = useApiKeys();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const createRef = useRef<HTMLButtonElement>(null);
  const close = () => {
    if (isCreating) return;
    setOpen(false);
    setRevealedKey(null);
  };
  const create = async () => {
    if (!name.trim() || isCreating) return;
    try {
      const created = await createKey(name.trim());
      setRevealedKey(created.key);
      setName("");
    } catch {
      /* Mutation displays the failure. */
    }
  };
  return (
    <div className="settings-keys">
      <SectionHeading
        className="settings-section-heading"
        title={m.settings_nav_api_keys()}
        description={m.settings_design_keys_hint()}
        actions={
          <Button
            ref={createRef}
            variant="primary"
            onClick={() => {
              setName("");
              setRevealedKey(null);
              setOpen(true);
            }}
            icon={<Plus size={16} />}
          >
            {m.settings_api_keys_create()}
          </Button>
        }
      />
      <div className="settings-key-list" aria-busy={isLoading}>
        {isError ? (
          <EmptyState
            description={m.settings_design_load_failed()}
            action={
              <Button onClick={() => void reload()}>
                {m.settings_design_retry()}
              </Button>
            }
          />
        ) : isLoading ? (
          <EmptyState description={m.settings_api_keys_loading()} />
        ) : keys.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            description={m.settings_api_keys_empty()}
          />
        ) : (
          <table>
            <thead>
              <tr>
                <th>{m.settings_api_keys_name_label()}</th>
                <th>{m.settings_design_key_prefix()}</th>
                <th>{m.settings_design_created_at()}</th>
                <th>
                  <span className="sr-only">
                    {m.settings_api_keys_delete()}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id}>
                  <td>
                    <strong>{key.name || m.settings_api_keys_unnamed()}</strong>
                  </td>
                  <td>
                    <code>{key.start ? `${key.start}…` : "—"}</code>
                  </td>
                  <td>
                    <ClientOnly fallback="—">
                      {formatDate(key.createdAt, { includeTime: true })}
                    </ClientOnly>
                  </td>
                  <td>
                    <Button
                      variant="plain"
                      tone="danger"
                      size="sm"
                      disabled={isDeleting}
                      onClick={() =>
                        setPendingDelete({
                          id: key.id,
                          name: key.name || m.settings_api_keys_unnamed(),
                        })
                      }
                    >
                      {m.settings_api_keys_delete()}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <footer className="settings-key-footer">
        <p>
          {m.settings_api_keys_created_hint()}
          <br />
          {m.settings_design_immediate()}
        </p>
        <span>
          {isLoading || isError
            ? "—"
            : m.settings_design_key_count({ count: keys.length })}
        </span>
      </footer>
      <ClientOnly>
        <FuwariModal
          open={open}
          onClose={close}
          busy={isCreating}
          labelledBy="create-api-key-title"
          initialFocus={() => inputRef.current}
          returnFocus={() => createRef.current}
        >
          <div className="p-6">
            <h2
              id="create-api-key-title"
              className="text-lg font-semibold fuwari-text-90"
            >
              {revealedKey
                ? m.settings_api_keys_created_title()
                : m.settings_api_keys_create()}
            </h2>
            {revealedKey ? (
              <div className="mt-4 space-y-4">
                <p className="text-sm fuwari-text-50">
                  {m.settings_api_keys_created_hint()}
                </p>
                <code className="block break-all rounded-xl bg-(--fuwari-btn-regular-bg) p-4 text-sm">
                  {revealedKey}
                </code>
                <div className="flex justify-end gap-2">
                  <Button onClick={close}>
                    {m.settings_api_keys_dismiss()}
                  </Button>
                  <Button
                    variant="primary"
                    icon={<Copy size={16} />}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(revealedKey);
                        toast.success(m.settings_api_keys_copied());
                      } catch {
                        toast.error(m.settings_design_copy_failed());
                      }
                    }}
                  >
                    {m.settings_api_keys_copy()}
                  </Button>
                </div>
              </div>
            ) : (
              <form
                className="mt-5 space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  void create();
                }}
              >
                <FormField label={m.settings_api_keys_name_label()}>
                  <Input
                    ref={inputRef}
                    value={name}
                    disabled={isCreating}
                    maxLength={32}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={m.settings_api_keys_name_ph()}
                  />
                </FormField>
                <div className="flex justify-end gap-2">
                  <Button onClick={close} disabled={isCreating}>
                    {m.common_cancel()}
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={!name.trim()}
                    loading={isCreating}
                  >
                    {m.settings_api_keys_create()}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </FuwariModal>
      </ClientOnly>
      <ConfirmationModal
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete || isDeleting) return;
          try {
            await deleteKey(pendingDelete.id);
            setPendingDelete(null);
          } catch {
            /* Keep the dialog for retry. */
          }
        }}
        title={m.settings_api_keys_delete_title()}
        message={m.settings_api_keys_delete_desc({
          name: pendingDelete?.name ?? "",
        })}
        confirmLabel={m.settings_api_keys_delete_confirm()}
        isDanger
        isLoading={isDeleting}
        fallbackFocus={() => createRef.current}
      />
    </div>
  );
}
