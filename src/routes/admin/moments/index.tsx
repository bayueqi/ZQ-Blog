import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  History,
  ImagePlus,
  Lock,
  Pencil,
  Pin,
  PinOff,
  Trash2,
  X,
} from "lucide-react";
import { useRef, useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import DatePicker from "@/components/ui/date-picker";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { PageHeader } from "@/components/ui/page-heading";
import { PasswordInput } from "@/components/ui/password-input";
import { Switch } from "@/components/ui/switch";
import type {
  AdminMoment,
  MomentImage,
} from "@/features/moments/moments.schema";
import "@/features/moments/components/admin/moments-workspace.css";
import "@/features/posts/components/post-manager/post-manager.css";
import { PostStatusBadge } from "@/features/posts/components/post-status-badge";
import { adminMomentsQuery } from "@/features/moments/queries";
import {
  RevisionHistoryDialog,
  type RevisionTarget,
} from "@/features/revisions/components/revision-history-dialog";
import { MediaPicker } from "@/features/media/components/media-library/components";
import type { MediaAsset } from "@/features/media/components/media-library/types";
import {
  getPublicImageSrc,
  isVideoUrl,
  PUBLIC_IMAGE_WIDTH,
} from "@/features/media/utils/media.utils";
import { orpc, orpcClient } from "@/lib/orpc";
import { handleORPCError } from "@/lib/orpc/error-handler";
import { siteDateKey } from "@/lib/site-time";
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
  /** 是否发布；和发布时间各管各的。 */
  published: boolean;
  /** 发布时间 YYYY-MM-DD；always 有值，不选就是今天。 */
  publishedAt: string;
}

const EMPTY_FORM: FormState = {
  id: null,
  body: "",
  images: [],
  password: "",
  passwordEnabled: false,
  hasPassword: false,
  published: true,
  publishedAt: siteDateKey(),
};

type Patch = (current: FormState) => FormState;

/** 时间戳换成站点时区的日历日；老数据没存日期就按今天算。 */
const dateKeyOf = (iso: string | null) =>
  iso ? siteDateKey(new Date(iso)) : siteDateKey();

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
              {isVideoUrl(image.url) ? (
                <video
                  src={image.url}
                  muted
                  playsInline
                  preload="metadata"
                  className="aspect-square w-full rounded-lg bg-black object-cover"
                />
              ) : (
                <img
                  src={getPublicImageSrc(image.url, PUBLIC_IMAGE_WIDTH.avatar)}
                  alt=""
                  className="aspect-square w-full rounded-lg object-cover"
                />
              )}
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

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <span className="w-16 shrink-0 whitespace-nowrap text-sm fuwari-text-75">
            {m.admin_moments_published()}
          </span>
          <Switch
            aria-label={m.admin_moments_published()}
            checked={value.published}
            onCheckedChange={(checked) =>
              onChange((current) => ({ ...current, published: checked }))
            }
            className="min-h-9"
          />
          <DatePicker
            value={value.publishedAt}
            onChange={(dateStr) =>
              onChange((current) => ({ ...current, publishedAt: dateStr }))
            }
          />
        </div>

        <div className="flex items-center gap-2.5">
          <span className="w-16 shrink-0 whitespace-nowrap text-sm fuwari-text-75">
            {m.editor_meta_visibility_password()}
          </span>
          <Switch
            aria-label={m.editor_meta_visibility_password()}
            checked={value.passwordEnabled}
            onCheckedChange={(checked) =>
              onChange((current) => ({
                ...current,
                passwordEnabled: checked,
                password: checked ? current.password : "",
              }))
            }
            className="min-h-9"
          />
        </div>

        {value.passwordEnabled ? (
          <div className="flex items-center gap-2.5">
            <span className="w-16 shrink-0 whitespace-nowrap text-sm fuwari-text-75">
              {m.editor_meta_access_password()}
            </span>
            <PasswordInput
              value={value.password}
              maxLength={100}
              secret
              autoComplete="new-password"
              className="max-w-xs"
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
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-(--admin-rule) pt-3">
        <Button
          ref={pickButtonRef}
          variant="plain"
          onClick={() => setPickerOpen(true)}
          disabled={value.images.length >= 9}
        >
          <ImagePlus size={15} strokeWidth={2} />
          {m.admin_moments_add_image()}
        </Button>

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
  /** 正在翻历史版本的那一条。 */
  const [history, setHistory] = useState<RevisionTarget | null>(null);
  const [pending, setPending] = useState<boolean>(false);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: adminMomentsQuery().queryKey });

  const create = useMutation({
    mutationFn: (input: {
      body: string;
      images: Array<MomentImage>;
      password?: string;
      published: boolean;
      publishedAt: string;
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
      publishedAt: string;
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
      publishedAt: dateKeyOf(target.publishedAt),
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
      publishedAt: dateKeyOf(moment.publishedAt),
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
        publishedAt: state.publishedAt,
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
    } catch (error) {
      handleORPCError(error, {
        defined: {
          EMPTY: () => toast.error(m.admin_moments_empty_content()),
          NOT_FOUND: () => toast.error(m.admin_moments_save_failed()),
        },
        fallback: (unknown) => {
          const detail = unknown instanceof Error ? unknown.message.trim() : "";
          toast.error(detail || m.admin_moments_save_failed());
        },
      });
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
          <div className="post-list-table-wrap moments-table">
            <table className="post-list-table">
              <colgroup>
                <col style={{ width: "44%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "14%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">{m.admin_moments_col_body()}</th>
                  <th scope="col">{m.admin_posts_filter_status()}</th>
                  <th scope="col">{m.admin_posts_time_published()}</th>
                  <th scope="col">{m.admin_posts_time_modified()}</th>
                  <th scope="col">{m.admin_posts_col_actions()}</th>
                </tr>
              </thead>
              <tbody>
                {moments.map((moment) => {
                  const active = editing?.id === moment.id ? editing : null;
                  if (active) {
                    return (
                      <tr key={moment.id} id={`admin-moment-${moment.id}`}>
                        <td colSpan={5}>
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
                        </td>
                      </tr>
                    );
                  }
                  const scheduled =
                    moment.published &&
                    moment.publishedAt != null &&
                    new Date(moment.publishedAt).getTime() > Date.now();
                  return (
                    <tr key={moment.id} id={`admin-moment-${moment.id}`}>
                      <td>
                        <div className="post-list-title-cell">
                          <span className="post-list-pin">
                            {moment.pinned ? (
                              <Pin size={18} aria-label={m.pinned_badge()} />
                            ) : null}
                          </span>
                          <div className="min-w-0">
                            <p className="line-clamp-2 whitespace-pre-wrap break-words text-sm fuwari-text-90">
                              {moment.body || m.admin_moments_image_only()}
                              {moment.hasPassword ? (
                                <Lock
                                  size={12}
                                  strokeWidth={2}
                                  className="post-list-lock ml-1.5 inline align-middle"
                                  aria-label={m.admin_moments_locked()}
                                />
                              ) : null}
                            </p>
                            {moment.images.length > 0 ? (
                              <div className="mt-1.5 flex gap-1">
                                {moment.images
                                  .slice(0, 4)
                                  .map((image, index) =>
                                    isVideoUrl(image.url) ? (
                                      <video
                                        key={`${image.url}-${index}`}
                                        src={image.url}
                                        muted
                                        playsInline
                                        preload="metadata"
                                        className="h-8 w-8 rounded bg-black object-cover"
                                      />
                                    ) : (
                                      <img
                                        key={`${image.url}-${index}`}
                                        src={getPublicImageSrc(
                                          image.url,
                                          PUBLIC_IMAGE_WIDTH.avatar,
                                        )}
                                        alt=""
                                        className="h-8 w-8 rounded object-cover"
                                      />
                                    ),
                                  )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td>
                        <PostStatusBadge
                          published={moment.published}
                          scheduled={scheduled}
                        />
                      </td>
                      <td className="post-list-date">
                        {moment.publishedAt
                          ? formatDate(moment.publishedAt)
                          : "—"}
                      </td>
                      <td className="post-list-date">
                        {moment.updatedAt ? formatDate(moment.updatedAt) : "—"}
                      </td>
                      <td>
                        <div className="flex items-center gap-0.5">
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
                            label={m.admin_revisions_open()}
                            onClick={() =>
                              setHistory({
                                type: "moment",
                                id: moment.id,
                              })
                            }
                          >
                            <History size={15} strokeWidth={2} />
                          </IconButton>
                          <IconButton
                            size="sm"
                            label={m.admin_moments_delete()}
                            onClick={() => setDeleting(moment)}
                          >
                            <Trash2 size={15} strokeWidth={2} />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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

      <RevisionHistoryDialog
        target={history}
        onClose={() => setHistory(null)}
        onRestored={() => void invalidate()}
      />
    </div>
  );
}
