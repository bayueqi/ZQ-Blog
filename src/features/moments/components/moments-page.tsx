import { useQuery } from "@tanstack/react-query";
import { ClientOnly, Link } from "@tanstack/react-router";
import { ChevronDown, Lock, MessageSquare, Pencil, Pin } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { PublicDateMeta } from "@/components/common/public-date-meta";
import { EmptyState } from "@/components/ui/empty-state";
import { CommentReveal } from "@/features/comments/components/comment-reveal";
import { CommentSection } from "@/features/comments/components/comment-section";
import { commentCountsQuery } from "@/features/comments/queries";
import type { MomentCard } from "@/features/moments/moments.schema";
import {
  getPublicImageSrc,
  isVideoUrl,
  PUBLIC_IMAGE_WIDTH,
} from "@/features/media/utils/media.utils";
import { ShareButton } from "@/features/share/share-dialog";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth/auth-client";
import { m } from "@/paraglide/messages";

type MomentImage = MomentCard["images"][number];

const HASH_ANCHOR_OFFSET = 96;

function useHashAnchorScroll(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const raw = window.location.hash.slice(1);
    if (!raw) return;

    let id = raw;
    try {
      id = decodeURIComponent(raw);
    } catch {
      id = raw;
    }

    let stopped = false;
    const timers: Array<number> = [];
    let observer: ResizeObserver | null = null;

    const align = () => {
      if (stopped) return;
      const el = document.getElementById(id);
      if (!el) return;
      const top = Math.max(
        0,
        Math.round(
          el.getBoundingClientRect().top + window.scrollY - HASH_ANCHOR_OFFSET,
        ),
      );
      if (Math.abs(top - window.scrollY) < 1) return;
      window.scrollTo({ top });
    };

    const stop = () => {
      stopped = true;
      observer?.disconnect();
      observer = null;
      for (const timer of timers) window.clearTimeout(timer);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", stop);
    };

    // 路由滚动恢复与图片加载都会改变目标位置，短暂跟随几次
    for (const delay of [0, 60, 160, 320, 700, 1200]) {
      timers.push(window.setTimeout(align, delay));
    }
    timers.push(window.setTimeout(stop, 3000));

    observer = new ResizeObserver(align);
    observer.observe(document.body);

    window.addEventListener("wheel", stop, { passive: true, once: true });
    window.addEventListener("touchstart", stop, { passive: true, once: true });
    window.addEventListener("keydown", stop, { once: true });

    return stop;
  }, [enabled]);
}

/** 链接带 `#moment-12` 时，只让那一条展开评论。 */
function useHashMomentId() {
  const [momentId, setMomentId] = useState<number | null>(null);

  useEffect(() => {
    const matched = /^#moment-(\d+)$/.exec(window.location.hash);
    setMomentId(matched ? Number(matched[1]) : null);
  }, []);

  return momentId;
}

function ImageGrid({ images }: { images: Array<MomentImage> }) {
  if (images.length === 0) return null;

  return (
    <div
      className={cn(
        "mt-3 grid gap-1.5",
        images.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3",
      )}
    >
      {images.map((image, index) =>
        isVideoUrl(image.url) ? (
          <video
            key={`${image.url}-${index}`}
            src={image.url}
            controls
            playsInline
            preload="metadata"
            className={cn(
              "w-full rounded-lg bg-black",
              images.length === 1 ? "max-h-[32rem]" : "aspect-square object-cover",
            )}
          />
        ) : (
          <img
            key={`${image.url}-${index}`}
            src={getPublicImageSrc(image.url, PUBLIC_IMAGE_WIDTH.body)}
            alt=""
            width={image.width ?? undefined}
            height={image.height ?? undefined}
            loading="lazy"
            className={cn(
              "w-full rounded-lg object-cover bg-(--fuwari-meta-divider)/20",
              images.length === 1 ? "max-h-[32rem]" : "aspect-square",
            )}
          />
        ),
      )}
    </div>
  );
}

function MomentLock({
  moment,
  onUnlocked,
}: {
  moment: MomentCard;
  onUnlocked: (body: string, images: Array<MomentImage>) => void;
}) {
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending || !password.trim()) return;

    setPending(true);
    setFailed(false);
    try {
      const response = await fetch("/api/moments-unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: moment.id, password }),
      });
      if (!response.ok) {
        setFailed(true);
        return;
      }
      const data = (await response.json()) as {
        body?: string;
        images?: Array<MomentImage>;
      };
      onUnlocked(data.body ?? "", data.images ?? []);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type="password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setFailed(false);
          }}
          placeholder={m.moments_password_placeholder()}
          aria-label={m.moments_password_placeholder()}
          className="h-9 min-w-0 flex-1 rounded-lg border border-(--fuwari-input-border) bg-transparent px-3 text-sm outline-none focus:border-(--fuwari-primary)"
        />
        <Button type="submit" variant="primary" disabled={pending}>
          {m.moments_unlock()}
        </Button>
      </div>
      {failed ? (
        <p className="text-xs text-red-500">{m.moments_wrong_password()}</p>
      ) : null}
    </form>
  );
}

function MomentItem({
  moment,
  first,
  commentCount,
  isAdmin,
  highlightCommentId,
  unlocked,
  onUnlocked,
}: {
  moment: MomentCard;
  first: boolean;
  commentCount: number;
  isAdmin: boolean;
  /** 有值时直接展开评论区并定位到那条评论。 */
  highlightCommentId?: number;
  /** 父组件已记录这条解锁过，用于立即把它挪出私密层。 */
  unlocked: boolean;
  onUnlocked: () => void;
}) {
  const [opened, setOpened] = useState<{
    body: string;
    images: Array<MomentImage>;
  } | null>(null);
  const [showComments, setShowComments] = useState(false);

  useEffect(() => {
    if (highlightCommentId != null) setShowComments(true);
  }, [highlightCommentId]);

  const locked = moment.locked && !unlocked && !opened;
  const body = opened?.body ?? moment.body;
  const images = opened?.images ?? moment.images;

  return (
    <article
      id={`moment-${moment.id}`}
      className={cn(
        "scroll-mt-24 py-5 first:pt-0 last:pb-0",
        !first && "border-t border-dashed border-(--fuwari-meta-divider)",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {locked ? (
          <h2 className="flex items-center gap-2 text-2xl font-bold fuwari-text-90">
            <Lock size={20} strokeWidth={2} />
            {m.moments_private_placeholder()} {moment.privateIndex ?? 1}
          </h2>
        ) : (
          <PublicDateMeta
            publishedAt={moment.publishedAt}
            updatedAt={moment.updatedAt}
          />
        )}
        {moment.pinned ? (
          <span className="flex items-center gap-1 text-xs font-medium text-(--fuwari-primary)">
            <Pin size={12} strokeWidth={2} className="fill-current" />
            {m.pinned_badge()}
          </span>
        ) : null}
        {!locked && moment.hasPassword ? (
          <Lock size={14} strokeWidth={2} className="fuwari-text-50" />
        ) : null}
        <div className="ml-auto flex items-center gap-3">
          {locked ? null : (
            <ShareButton path={`/moments#moment-${moment.id}`} />
          )}
          <ClientOnly>
            {isAdmin ? (
              <Link
                to="/admin/moments"
                search={{ moment: moment.id }}
                className="flex items-center gap-1 text-xs fuwari-text-50 transition-colors hover:text-(--fuwari-primary)"
              >
                <Pencil size={12} strokeWidth={2} />
                {m.moments_edit_admin()}
              </Link>
            ) : null}
          </ClientOnly>
        </div>
      </div>
      {locked ? (
        <MomentLock
          moment={moment}
          onUnlocked={(nextBody, nextImages) => {
            setOpened({ body: nextBody, images: nextImages });
            onUnlocked();
          }}
        />
      ) : (
        <>
          {body ? (
            <p className="mt-2 whitespace-pre-wrap break-words text-base leading-relaxed fuwari-text-90">
              {body}
            </p>
          ) : null}
          <ImageGrid images={images} />
        </>
      )}

      {locked ? null : (
        <>
          <button
            type="button"
            aria-expanded={showComments}
            onClick={() => setShowComments((current) => !current)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md text-sm fuwari-text-50 transition-colors hover:text-(--fuwari-primary)"
          >
            <MessageSquare size={14} strokeWidth={2} />
            {commentCount > 0
              ? m.moments_comments_count({ count: commentCount })
              : m.moments_comments_empty()}
            <ChevronDown
              size={14}
              strokeWidth={2}
              className={cn("transition", showComments && "rotate-180")}
            />
          </button>
          <CommentReveal open={showComments}>
            <div className="mt-4">
              <CommentSection
                target={{ targetType: "moment", targetId: moment.id }}
                highlightCommentId={highlightCommentId}
              />
            </div>
          </CommentReveal>
        </>
      )}
    </article>
  );
}

export function MomentsPage({
  moments,
  highlightCommentId,
}: {
  moments: Array<MomentCard>;
  /** 从通知或评论管理跳进来时要定位到的那条评论。 */
  highlightCommentId?: number;
}) {
  // 定位到具体评论时让评论自己滚动，别再抢着贴到日常的锚点。
  useHashAnchorScroll(highlightCommentId == null);
  const hashMomentId = useHashMomentId();
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === "admin";
  const ids = moments.map((moment) => moment.id);
  const { data: commentCounts } = useQuery({
    ...commentCountsQuery("moment", ids),
    enabled: ids.length > 0,
  });
  const counts = commentCounts?.counts ?? {};

  // 就地解锁过的日常，立即从私密层挪到普通层，不必刷新。
  const [unlockedIds, setUnlockedIds] = useState<Set<number>>(
    () => new Set(),
  );
  const unlock = (id: number) =>
    setUnlockedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });

  const isLocked = (moment: MomentCard) =>
    moment.locked && !unlockedIds.has(moment.id);

  // 三段式：置顶在上，普通居中，私密在下。
  const pinnedMoments = moments.filter(
    (moment) => moment.pinned && !isLocked(moment),
  );
  const normalMoments = moments.filter(
    (moment) => !moment.pinned && !isLocked(moment),
  );
  const lockedMoments = moments.filter(isLocked);
  const groups = [
    { key: "pinned", items: pinnedMoments },
    { key: "normal", items: normalMoments },
    { key: "locked", items: lockedMoments },
  ].filter((group) => group.items.length > 0);

  return (
    <section className="fuwari-card-base p-6 fuwari-content-enter">
      <header className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold fuwari-text-90">
          {m.moments_title()}
        </h1>
      </header>

      {moments.length === 0 ? (
        <EmptyState description={m.moments_empty()} />
      ) : (
        <div className="flex flex-col">
          {groups.map((group, groupIndex) => (
            <div
              key={group.key}
              className={
                groupIndex > 0
                  ? "mt-5 border-t border-black pt-1 dark:border-white/70"
                  : undefined
              }
            >
              {group.items.map((moment, index) => (
                <MomentItem
                  key={moment.id}
                  moment={moment}
                  first={index === 0}
                  commentCount={counts[String(moment.id)] ?? 0}
                  isAdmin={isAdmin}
                  unlocked={unlockedIds.has(moment.id)}
                  onUnlocked={() => unlock(moment.id)}
                  highlightCommentId={
                    hashMomentId === moment.id ? highlightCommentId : undefined
                  }
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
