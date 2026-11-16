import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClientOnly } from "@tanstack/react-router";
import { Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { FuwariModal } from "@/components/ui/fuwari-modal";
import { IconButton } from "@/components/ui/icon-button";
import {
  getPublicImageSrc,
  isVideoUrl,
  PUBLIC_IMAGE_WIDTH,
} from "@/features/media/utils/media.utils";
import {
  contentRevisionDetailQuery,
  contentRevisionsQuery,
} from "@/features/revisions/queries";
import type {
  GalleryRevisionSnapshotView,
  MomentRevisionSnapshotView,
} from "@/features/revisions/revisions.schema";
import { cn, formatDate } from "@/lib/utils";
import { orpcClient } from "@/lib/orpc";
import { m } from "@/paraglide/messages";

export interface RevisionTarget {
  type: "moment" | "gallery";
  id: number;
}

interface Props {
  target: RevisionTarget | null;
  onClose: () => void;
  /** 恢复或删除成功后让调用方刷新自己的列表。 */
  onRestored?: () => void;
}

function RevisionHistoryDialogInternal({ target, onClose, onRestored }: Props) {
  const queryClient = useQueryClient();
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<null | "restore" | "delete">(null);

  const input = {
    targetType: target?.type ?? ("moment" as const),
    targetId: target?.id ?? 0,
  };

  const { data, isLoading } = useQuery({
    ...contentRevisionsQuery(input),
    enabled: Boolean(target),
  });
  const revisions = data?.revisions ?? [];
  // 默认停在最新一条，点别的再切。
  const selected =
    revisions.find((revision) => revision.id === pickedId) ??
    revisions[0] ??
    null;

  const detailQuery = useQuery({
    ...contentRevisionDetailQuery({
      ...input,
      revisionId: selected?.id ?? 0,
    }),
    enabled: Boolean(target) && selected != null,
  });
  const detail = detailQuery.data ?? null;

  const restore = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("REVISION_NOT_SELECTED");
      return orpcClient.revisions.admin.restore({
        ...input,
        revisionId: selected.id,
      });
    },
    onSuccess: async () => {
      setConfirm(null);
      toast.success(m.admin_revisions_restored());
      await queryClient.invalidateQueries({
        queryKey: contentRevisionsQuery(input).queryKey,
      });
      await queryClient.invalidateQueries({
        queryKey: contentRevisionDetailQuery({
          ...input,
          revisionId: selected?.id ?? 0,
        }).queryKey,
      });
      onRestored?.();
    },
    onError: () => {
      setConfirm(null);
      toast.error(m.admin_revisions_restore_failed());
    },
  });

  const remove = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("REVISION_NOT_SELECTED");
      return orpcClient.revisions.admin.remove({
        ...input,
        revisionIds: [selected.id],
      });
    },
    onSuccess: async () => {
      setConfirm(null);
      setPickedId(null);
      toast.success(m.admin_revisions_deleted());
      await queryClient.invalidateQueries({
        queryKey: contentRevisionsQuery(input).queryKey,
      });
      onRestored?.();
    },
    onError: () => {
      setConfirm(null);
      toast.error(m.admin_revisions_delete_failed());
    },
  });

  const busy = restore.isPending || remove.isPending;
  const canAct = selected != null && !busy;

  return (
    <>
      <FuwariModal
        open={Boolean(target)}
        onClose={onClose}
        label={m.editor_history_list_title()}
        className="fuwari-modal-wide fuwari-modal-revisions"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-(--list-rule) px-5 py-3.5">
          <h2 className="truncate text-base font-semibold">
            {m.editor_history_list_title()}
          </h2>
          <IconButton label={m.common_close()} onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>

        {isLoading ? (
          <div className="flex px-5 py-8 md:flex-1 md:items-center md:justify-center">
            <p className="text-center text-sm fuwari-text-75">
              {m.editor_history_loading()}
            </p>
          </div>
        ) : revisions.length === 0 ? (
          <div className="flex py-8 md:flex-1 md:items-center md:justify-center">
            <EmptyState description={m.editor_history_empty()} />
          </div>
        ) : (
          <div className="grid min-h-0 grid-cols-1 md:flex-1 md:grid-cols-[15rem_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)]">
            <ul className="max-h-[30vh] overflow-y-auto border-b border-(--list-rule) md:max-h-none md:min-h-0 md:border-b-0 md:border-r">
              {revisions.map((revision) => (
                <li key={revision.id}>
                  <button
                    type="button"
                    onClick={() => setPickedId(revision.id)}
                    aria-current={
                      revision.id === selected?.id ? "true" : undefined
                    }
                    className={cn(
                      "flex w-full flex-col gap-1 border-b border-(--list-rule) px-4 py-3 text-left last:border-b-0",
                      revision.id === selected?.id
                        ? "bg-(--fuwari-btn-regular-bg) text-(--fuwari-primary)"
                        : "hover:bg-(--fuwari-btn-regular-bg)/60",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {formatDate(revision.createdAt)}
                      </span>
                      {revision.current ? (
                        <span className="shrink-0 rounded-full border border-current px-1.5 py-px text-[11px] leading-tight">
                          {m.admin_revisions_current()}
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        "line-clamp-2 text-xs",
                        revision.id === selected?.id
                          ? "text-(--fuwari-btn-content)"
                          : "fuwari-text-50",
                      )}
                    >
                      {revision.title || m.admin_moments_image_only()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="max-h-[58vh] overflow-y-auto px-6 py-5 md:max-h-none md:min-h-0">
              <RevisionSnapshotPreview
                targetType={input.targetType}
                snapshot={detail?.snapshot ?? null}
                publishedAt={selected?.publishedAt ?? null}
                isLoading={detailQuery.isLoading}
              />
            </div>
          </div>
        )}

        {revisions.length > 0 ? (
          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-(--list-rule) px-5 py-3">
            <Button
              variant="plain"
              tone="danger"
              onClick={() => setConfirm("delete")}
              disabled={!canAct}
              icon={<Trash2 size={15} />}
            >
              {m.editor_history_delete_action()}
            </Button>
            <Button
              variant="primary"
              onClick={() => setConfirm("restore")}
              disabled={!canAct}
            >
              {m.editor_history_restore_action()}
            </Button>
          </footer>
        ) : null}
      </FuwariModal>

      <ConfirmationModal
        isOpen={confirm === "restore"}
        onClose={() => setConfirm(null)}
        onConfirm={() => restore.mutate()}
        title={m.editor_history_restore_title()}
        message={m.admin_revisions_restore_message()}
        confirmLabel={m.editor_history_restore_action()}
        isLoading={restore.isPending}
      />
      <ConfirmationModal
        isOpen={confirm === "delete"}
        onClose={() => setConfirm(null)}
        onConfirm={() => remove.mutate()}
        title={m.editor_history_delete_title()}
        message={m.admin_revisions_delete_message()}
        confirmLabel={m.editor_history_delete_action()}
        isLoading={remove.isPending}
        isDanger
      />
    </>
  );
}

interface PreviewTile {
  key: string;
  url: string;
  video: boolean;
  alt?: string;
}

function MediaGrid({ items }: { items: Array<PreviewTile> }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      {items.map((item) =>
        item.video ? (
          <video
            key={item.key}
            src={item.url}
            muted
            playsInline
            preload="metadata"
            controls
            className="aspect-square w-full rounded-lg bg-black object-cover"
          />
        ) : (
          <img
            key={item.key}
            src={getPublicImageSrc(item.url, PUBLIC_IMAGE_WIDTH.avatar)}
            alt={item.alt ?? ""}
            className="aspect-square w-full rounded-lg object-cover"
          />
        ),
      )}
    </div>
  );
}

function RevisionSnapshotPreview({
  targetType,
  snapshot,
  publishedAt,
  isLoading,
}: {
  targetType: "moment" | "gallery";
  snapshot: MomentRevisionSnapshotView | GalleryRevisionSnapshotView | null;
  publishedAt: string | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <p className="text-sm fuwari-text-75">{m.editor_history_loading()}</p>
    );
  }
  if (!snapshot) return null;

  const shownAt = publishedAt ? formatDate(publishedAt) : null;

  if (targetType === "moment") {
    const moment = snapshot as MomentRevisionSnapshotView;
    const items = moment.images.map((image, index) => ({
      key: `${image.url}-${index}`,
      url: image.url,
      video: isVideoUrl(image.url),
    }));
    return (
      <div>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {moment.body || m.admin_moments_image_only()}
        </p>
        <MediaGrid items={items} />
        {shownAt ? (
          <p className="mt-3 text-xs fuwari-text-50">{shownAt}</p>
        ) : null}
      </div>
    );
  }

  const gallery = snapshot as GalleryRevisionSnapshotView;
  const items = (gallery.photos ?? []).map((photo, index) => ({
    key: `${photo.mediaId}-${index}`,
    url: photo.url,
    video: photo.mimeType
      ? photo.mimeType.startsWith("video/")
      : isVideoUrl(photo.url),
    alt: photo.caption ?? undefined,
  }));
  return (
    <div>
      <p className="text-sm font-medium">{gallery.name}</p>
      {gallery.description ? (
        <p className="mt-1 whitespace-pre-wrap break-words text-sm fuwari-text-75">
          {gallery.description}
        </p>
      ) : null}
      <MediaGrid items={items} />
      {shownAt ? (
        <p className="mt-3 text-xs fuwari-text-50">{shownAt}</p>
      ) : null}
    </div>
  );
}

/** 日常和相册共用：列出历史，看内容，恢复或删除。 */
export function RevisionHistoryDialog(props: Props) {
  return (
    <ClientOnly>
      <RevisionHistoryDialogInternal {...props} />
    </ClientOnly>
  );
}
