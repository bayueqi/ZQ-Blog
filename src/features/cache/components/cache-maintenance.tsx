import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { orpcClient } from "@/lib/orpc";
import { StatusText } from "@/components/ui/status-text";
import { m } from "@/paraglide/messages";

export function CacheMaintenance() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: () => orpcClient.cache.invalidate(),
    onSuccess: () =>
      toast.success(m.settings_maintenance_cache_toast_success()),
    onError: () => toast.error(m.settings_maintenance_cache_toast_error()),
  });
  const handleInvalidate = () => {
    setIsModalOpen(false);
    mutation.mutate();
  };

  return (
    <>
      <div className="flex items-center gap-3 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium fuwari-text-90">
            {m.settings_maintenance_cache_title()}
          </p>
          <p className="text-xs fuwari-text-50">
            {m.settings_maintenance_cache_desc_short()}
          </p>
          {mutation.isSuccess && (
            <StatusText className="mt-2">
              {m.settings_maintenance_cache_toast_success()}
            </StatusText>
          )}
          {mutation.isError && (
            <StatusText error className="mt-2">
              {m.settings_maintenance_cache_toast_error()}
            </StatusText>
          )}
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          loading={mutation.isPending}
        >
          {mutation.isPending
            ? m.common_processing()
            : m.settings_maintenance_cache_btn()}
        </Button>
      </div>
      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleInvalidate}
        title={m.settings_maintenance_cache_confirm_title()}
        message={m.settings_maintenance_cache_confirm_message()}
        confirmLabel={m.settings_maintenance_cache_confirm_btn()}
        isDanger
      />
    </>
  );
}
