import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Copy, ExternalLink, FileText, Images, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FuwariModal } from "@/components/ui/fuwari-modal";
import { IconButton } from "@/components/ui/icon-button";
import { SectionHeading } from "@/components/ui/page-heading";
import {
  MOTION,
  useContentMotion,
  useMediaQuery,
  useReducedMotion,
} from "@/hooks/use-motion";
import { toast } from "sonner";
import {
  linkedGalleriesQuery,
  linkedPostsQuery,
} from "@/features/media/queries";
import { formatBytes, formatDate } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import type { MediaAsset } from "../types";

export function MediaDetail({
  asset,
  open,
  onClose,
  onDelete,
  preventClose = false,
}: {
  asset: MediaAsset;
  open: boolean;
  onClose: () => void;
  onDelete: (asset: MediaAsset) => void;
  preventClose?: boolean;
}) {
  const reduced = useReducedMotion();
  const compact = useMediaQuery("(max-width: 1199px)");
  const contentRef = useRef<HTMLDivElement>(null);
  useContentMotion(contentRef, `${asset.key}:${compact}`);
  useEffect(() => {
    const inspector =
      contentRef.current?.closest<HTMLElement>(".media-inspector");
    if (inspector) inspector.scrollTop = 0;
  }, [asset.key]);
  const inUse = asset.postCount > 0 || asset.galleryCount > 0;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const {
    data: linkedPosts = [],
    isPending: postsPending,
    isError: postsError,
    refetch: refetchPosts,
  } = useQuery(linkedPostsQuery(asset.key));
  const {
    data: linkedGalleries = [],
    isPending: galleriesPending,
    isError: galleriesError,
    refetch: refetchGalleries,
  } = useQuery(linkedGalleriesQuery(asset.key));
  // 同一相册的封面引用和照片引用是两条，按「相册 + 用途」去重。
  const galleries = useMemo(() => {
    const seen = new Set<string>();
    return linkedGalleries.filter((item) => {
      const key = `${item.id}:${item.isCover ? "cover" : "photo"}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [linkedGalleries]);

  useEffect(() => {
    if (!open || compact || preventClose) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        closeRef.current();
      }
    };
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, [open, compact, preventClose]);

  const content = (
    <>
      <SectionHeading
        className="media-inspector-header"
        size="sm"
        title={m.media_preview_title()}
        actions={
          <IconButton
            label={m.common_close()}
            size="md"
            disabled={preventClose}
            onClick={onClose}
          >
            <X size={19} />
          </IconButton>
        }
      />
      <div ref={contentRef}>
        <div className="media-inspector-preview">
          <img
            src={asset.url}
            alt={asset.fileName}
            onLoad={(event) => {
              if (open && !reduced)
                event.currentTarget.animate([{ opacity: 0 }, { opacity: 1 }], {
                  duration: MOTION.content,
                  easing: "ease-out",
                });
            }}
          />
        </div>
        <div className="media-inspector-name">
          <span>{asset.fileName}</span>
        </div>
        <p className="media-inspector-facts">
          {asset.width && asset.height
            ? `${asset.width} × ${asset.height} · `
            : ""}
          {formatBytes(asset.sizeInBytes)} ·{" "}
          {formatDate(asset.createdAt, { includeTime: true })}
        </p>
        <section className="media-inspector-usage">
          {asset.postCount > 0 ? (
            <>
              <h3>{m.media_used_in({ count: asset.postCount })}</h3>
              {postsError ? (
                <p>
                  {m.media_reference_fail()}{" "}
                  <Button
                    variant="text"
                    size="sm"
                    onClick={() => void refetchPosts()}
                  >
                    {m.media_load_retry()}
                  </Button>
                </p>
              ) : postsPending ? (
                <p>{m.media_grid_loading()}</p>
              ) : (
                linkedPosts.map((post) => (
                  <Link
                    key={post.id}
                    to="/admin/posts/edit/$id"
                    params={{ id: String(post.id) }}
                    className="media-reference"
                  >
                    <FileText size={16} />
                    <span>{post.title}</span>
                    {post.isCover ? (
                      <small>{m.media_badge_cover()}</small>
                    ) : null}
                    <ExternalLink size={14} />
                  </Link>
                ))
              )}
            </>
          ) : null}
          {asset.galleryCount > 0 ? (
            <div
              className={asset.postCount > 0 ? "media-usage-group" : undefined}
            >
              <h3>{m.media_used_in_gallery({ count: asset.galleryCount })}</h3>
              {galleriesError ? (
                <p>
                  {m.media_reference_fail()}{" "}
                  <Button
                    variant="text"
                    size="sm"
                    onClick={() => void refetchGalleries()}
                  >
                    {m.media_load_retry()}
                  </Button>
                </p>
              ) : galleriesPending ? (
                <p>{m.media_grid_loading()}</p>
              ) : (
                galleries.map((gallery) => (
                  <Link
                    key={`${gallery.id}:${gallery.isCover ? "cover" : "photo"}`}
                    to="/admin/gallery"
                    // 封面指向相册集列表，照片指向相册里的照片墙。
                    search={gallery.isCover ? {} : { collection: gallery.id }}
                    className="media-reference"
                  >
                    <Images size={16} />
                    <span>{gallery.name}</span>
                    <small>
                      {gallery.isCover
                        ? m.media_badge_cover()
                        : m.media_badge_photo()}
                    </small>
                    <ExternalLink size={14} />
                  </Link>
                ))
              )}
            </div>
          ) : null}
          {!inUse ? <h3>{m.media_unreferenced()}</h3> : null}
        </section>
        <div className="media-inspector-actions">
          <Button
            icon={<Copy size={16} />}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  new URL(asset.url, window.location.origin).href,
                );
                toast.success(m.media_copied());
              } catch {
                toast.error(m.media_copy_failed());
              }
            }}
          >
            {m.media_copy_link()}
          </Button>
          {inUse ? null : (
            <Button
              variant="danger"
              icon={<Trash2 size={16} />}
              disabled={preventClose}
              onClick={() => onDelete(asset)}
            >
              {m.media_delete()}
            </Button>
          )}
        </div>
      </div>
    </>
  );
  return compact ? (
    <FuwariModal
      open={open}
      onClose={onClose}
      busy={preventClose}
      className="media-inspector media-inspector-dialog admin-workspace"
      label={m.media_preview_title()}
    >
      {content}
    </FuwariModal>
  ) : (
    <aside
      className="media-inspector"
      data-state={open ? "open" : "closing"}
      inert={!open}
      aria-label={m.media_preview_title()}
    >
      {content}
    </aside>
  );
}
