import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ImagePlus, Lock, Pencil, Pin, PinOff, Trash2, X } from "lucide-react";
import { useRef, useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { IconButton } from "@/components/ui/icon-button";
import { PageHeader } from "@/components/ui/page-heading";
import { PasswordInput } from "@/components/ui/password-input";
import { Switch } from "@/components/ui/switch";
import type {
  AdminMoment,
  MomentImage,
} from "@/features/moments/moments.schema";
import "@/features/moments/components/admin/moments-workspace.css";
import { adminMomentsQuery } from "@/features/moments/queries";
import { MediaPicker } from "@/features/media/components/media-library/components";
import type { MediaAsset } from "@/features/media/components/media-library/types";
import {
  getPublicImageSrc,
  PUBLIC_IMAGE_WIDTH,
} from "@/features/media/utils/media.utils";
import { orpc, orpcClient } from "@/lib/orpc";
import { formatDate } from "@/lib/utils";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/admin/moments/")({
  ssr: false,
  validateSearch: z.object({
    moment: z.number().optional().catch(undefined),
  }),
  component: AdminMomentsPage,
  loader: () => ({ title: m.admin_moments_manage_title() }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.title }],
  }),
});

interface FormState {
  id: number | null;
  body: string;
  images: Array<MomentImage>;
  /** 新输入的密码，空表示不换。 */
  password: string;
  /** 开关是否打开；打开才显示密码框，清空输入不会把框收走。 */
  passwordEnabled: boolean;
  /** 库里原本就有密码。 */
  hasPassword: boolean;
  published: boolean;
}

const EMPTY_FORM: FormState = {
  id: null,
  body: "",
  images: [],
  password: "",
  passwordEnabled: false,
  hasPassword: false,
  published: true,
};

type Patch = (current: FormState) => FormState;

/** 新建卡片和就地编辑共用这一套字段。 */
function MomentEditor({
  value,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  pending,
  autoFocus = false,
}: {
  value: FormState;
  onChange: (patch: Patch) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  submitLabel: string;
  pending: boolean;
  autoFocus?: boolean;
}) {
  const pickButtonRef = useRef<HTMLButtonElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const addImage = (media: MediaAsset) =>
    onChange((current) => ({
      ...current,
      images: [
        ...current.images,
        {
          url: media.url,
          width: media.width ?? null,
          height: media.height ?? null,
        },
      ].slice(0, 9),
    }));

  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={value.body}
        onChange={(event) =>
          onChange((current) => ({ ...current, body: event.target.value }))
        }
        rows={4}
        maxLength={2000}
        autoFocus={autoFocus}
        placeholder={m.admin_moments_body_placeholder()}
        aria-label={m.admin_moments_body_placeholder()}
        className="w-full resize-y rounded-lg border border-(--fuwari-input-border) bg-transparent px-3 py-2 text-sm leading-relaxed outline-none focus:border-(--fuwari-primary)"
      />

      {value.images.length > 0 ? (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {value.images.map((image, index) => (
            <div key={`${image.url}-${index}`} className="relative">
              <img
                src={getPublicImageSrc(image.url, PUBLIC_IMAGE_WIDTH.avatar)}
                alt=""
                className="aspect-square w-full rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() =>
                  onChange((current) => ({
                    ...current,
                    images: current.images.filter((_, i) => i !== index),
                  }))
                }
                aria-label={m.admin_moments_remove_image()}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
              >
                <X size={12} strokeWidth={2.5} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          ref={pickButtonRef}
          variant="plain"
          onClick={() => setPickerOpen(true)}
          disabled={value.images.length >= 9}
        >
          <ImagePlus size={15} strokeWidth={2} />
          {m.admin_moments_add_image()}
        </Button>

        <label className="flex items-center gap-1.5 text-sm fuwari-text-75">
          <input
            type="checkbox"
            checked={value.published}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                published: event.target.checked,
              }))
            }
          />
          {m.admin_moments_published()}
        </label>

        <div className="ml-auto flex items-center gap-2">
          {onCancel ? (
            <Button variant="text" onClick={onCancel}>
              {m.admin_moments_cancel()}
            </Button>
          ) : null}
          <Button variant="primary" onClick={onSubmit} disabled={pending}>
            {submitLabel}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Switch
          label={m.editor_meta_visibility_password()}
          checked={value.passwordEnabled}
          onCheckedChange={(checked) =>
            onChange((current) => ({
              ...current,
              passwordEnabled: checked,
              password: checked ? current.password : "",
            }))
          }
          className="min-h-10 w-auto text-sm"
        />
        {value.passwordEnabled ? (
          <FormField
            label={m.editor_meta_access_password()}
            className="max-w-xs"
          >
            <PasswordInput
              value={value.password}
              maxLength={100}
              secret
              autoComplete="new-password"
              placeholder={
                value.hasPassword
                  ? m.editor_meta_access_password_keep()
                  : m.editor_meta_access_password_placeholder()
              }
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
            />
          </FormField>
        ) : null}
      </div>

      <MediaPicker
        open={pickerOpen}
        title={m.admin_moments_pick_image()}
        onClose={() => setPickerOpen(false)}
        returnFocus={() => pickButtonRef.current}
        onSelect={(media) => {
          addImage(media);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}

function AdminMomentsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(adminMomentsQuery());
  const [draft, setDraft] = useState<FormState>(EMPTY_FORM);
  /** 正在就地编辑的那一条，null 表示没有。 */
  const [editing, setEditing] = useState<FormState | null>(null);
  /** 等待确认删除的那一条。 */
  const [deleting, setDeleting] = useState<AdminMoment | null>(null);
  const [pending, setPending] = useState<boolean>(false);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: adminMomentsQuery().queryKey });

  const create = useMutation({
    mutationFn: (input: {
      body: string;
      images: Array<MomentImage>;
      password?: string;
      published: boolean;
    }) => orpcClient.moments.admin.create(input),
    onSuccess: () => void invalidate(),
  });

  const update = useMutation({
    mutationFn: (input: {
      id: number;
      body: string;
      images: Array<MomentImage>;
      password?: string;
      published: boolean;
    }) => orpcClient.moments.admin.update(input),
    onSuccess: () => void invalidate(),
  });

  const remove = useMutation({
    mutationFn: (id: number) => orpcClient.moments.admin.remove({ id }),
    onSuccess: () => void invalidate(),
  });

  const pinned = useMutation({
    mutationFn: (moment: Pick<AdminMoment, "id" | "pinned">) =>
      orpcClient.moments.admin.pin({
        id: moment.id,
        pinned: !moment.pinned,
      }),
    onSuccess: (_result, moment) => {
      // 置顶会改前台的顺序，前台的列表也一起重取。
      void queryClient.invalidateQueries({ queryKey: orpc.moments.key() });
      toast.success(
        moment.pinned ? m.admin_unpinned_toast() : m.admin_pinned_toast(),
      );
    },
    onError: () => toast.error(m.admin_moments_save_failed()),
  });

  const moments = data?.moments ?? [];
  const { moment: momentParam } = Route.useSearch();
  const handledMomentParam = useRef<number | null>(null);

  // 从相册/日常前台点「编辑日常」进来时，直接展开那一条并滚到它。
  useEffect(() => {
    if (momentParam == null || handledMomentParam.current === momentParam) {
      return;
    }
    const target = moments.find((item) => item.id === momentParam);
    if (!target) return;
    handledMomentParam.current = momentParam;
    setEditing({
      id: target.id,
      body: target.body,
      images: target.images,
      password: "",
      passwordEnabled: target.hasPassword,
      hasPassword: target.hasPassword,
      published: target.published,
    });
    requestAnimationFrame(() => {
      document
        .getElementById(`admin-moment-${target.id}`)
        ?.scrollIntoView({ block: "center" });
    });
  }, [momentParam, moments]);

  const startEdit = (moment: AdminMoment) =>
    setEditing({
      id: moment.id,
      body: moment.body,
      images: moment.images,
      password: "",
      passwordEnabled: moment.hasPassword,
      hasPassword: moment.hasPassword,
      published: moment.published,
    });

  const save = async (state: FormState) => {
    if (pending) return;
    setPending(true);
    try {
      const protectedNow = state.passwordEnabled;
      const payload = {
        body: state.body,
        images: state.images,
        published: state.published,
        // 填了新密码就换；开关留着但没填表示保持原密码；关掉开关传空串表示取消密码。
        ...(protectedNow
          ? state.password.trim()
            ? { password: state.password }
            : {}
          : { password: "" }),
      };
      if (state.id === null) {
        await create.mutateAsync(payload);
        setDraft(EMPTY_FORM);
      } else {
        await update.mutateAsync({ id: state.id, ...payload });
        setEditing(null);
      }
      toast.success(m.admin_moments_saved());
    } catch {
      toast.error(m.admin_moments_save_failed());
    } finally {
      setPending(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const id = deleting.id;
    try {
      await remove.mutateAsync(id);
      if (editing?.id === id) setEditing(null);
      toast.success(m.admin_moments_deleted());
      setDeleting(null);
    } catch {
      toast.error(m.admin_moments_delete_failed());
    }
  };

  return (
    <div className="moments-workspace admin-workspace fuwari-card-base">
      <PageHeader
        className="moments-header"
        title={m.admin_moments_manage_title()}
        description={m.admin_moments_description({ count: moments.length })}
      />

      <div className="moments-body custom-scrollbar">
        <section className="moments-compose">
          <MomentEditor
            value={draft}
            onChange={setDraft}
            onSubmit={() => void save(draft)}
            submitLabel={m.admin_moments_save()}
            pending={pending}
          />
        </section>

        {isLoading ? null : moments.length === 0 ? (
          <EmptyState description={m.admin_moments_empty()} />
        ) : (
          <ul className="moments-list">
            {moments.map((moment) => {
              const active = editing?.id === moment.id ? editing : null;
              if (active) {
                return (
                  <li
                    key={moment.id}
                    id={`admin-moment-${moment.id}`}
                    className="moments-item moments-item-editing"
                  >
                    <MomentEditor
                      value={active}
                      onChange={(patch) =>
                        setEditing((current) =>
                          current ? patch(current) : current,
                        )
                      }
                      onSubmit={() => void save(active)}
                      onCancel={() => setEditing(null)}
                      submitLabel={m.admin_moments_save()}
                      pending={pending}
                      autoFocus
                    />
                  </li>
                );
              }
              return (
                <li
                  key={moment.id}
                  id={`admin-moment-${moment.id}`}
                  className="moments-item"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-mono text-xs fuwari-text-50">
                      <span>
                        {formatDate(moment.publishedAt, { includeTime: true })}
                      </span>
                      {moment.pinned ? (
                        <Pin
                          size={12}
                          strokeWidth={2}
                          aria-label={m.pinned_badge()}
                        />
                      ) : null}
                      {moment.hasPassword ? (
                        <Lock
                          size={12}
                          strokeWidth={2}
                          aria-label={m.admin_moments_locked()}
                        />
                      ) : null}
                      {moment.published ? null : (
                        <span className="rounded bg-(--fuwari-meta-divider)/20 px-1.5 py-0.5">
                          {m.admin_moments_draft()}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-sm fuwari-text-90">
                      {moment.body || m.admin_moments_image_only()}
                    </p>
                    {moment.images.length > 0 ? (
                      <div className="mt-2 flex gap-1.5">
                        {moment.images.slice(0, 6).map((image, index) => (
                          <img
                            key={`${image.url}-${index}`}
                            src={getPublicImageSrc(
                              image.url,
                              PUBLIC_IMAGE_WIDTH.avatar,
                            )}
                            alt=""
                            className="h-10 w-10 rounded object-cover"
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <IconButton
                      size="sm"
                      label={
                        moment.pinned
                          ? m.admin_moments_unpin()
                          : m.admin_moments_pin()
                      }
                      onClick={() => pinned.mutate(moment)}
                    >
                      {moment.pinned ? (
                        <PinOff size={15} strokeWidth={2} />
                      ) : (
                        <Pin size={15} strokeWidth={2} />
                      )}
                    </IconButton>
                    <IconButton
                      size="sm"
                      label={m.admin_moments_edit()}
                      onClick={() => startEdit(moment)}
                    >
                      <Pencil size={15} strokeWidth={2} />
                    </IconButton>
                    <IconButton
                      size="sm"
                      label={m.admin_moments_delete()}
                      onClick={() => setDeleting(moment)}
                    >
                      <Trash2 size={15} strokeWidth={2} />
                    </IconButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmationModal
        isOpen={deleting !== null}
        isLoading={remove.isPending}
        isDanger
        title={m.admin_moments_delete()}
        message={m.admin_moments_delete_confirm()}
        confirmLabel={m.admin_moments_delete()}
        onClose={() => {
          if (!remove.isPending) setDeleting(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
