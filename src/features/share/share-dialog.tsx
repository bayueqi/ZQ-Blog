import { ClientOnly, useRouteContext } from "@tanstack/react-router";
import { Share2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { FuwariModal } from "@/components/ui/fuwari-modal";
import { IconButton } from "@/components/ui/icon-button";
import { m } from "@/paraglide/messages";
import "./share.css";

const QR_PIXEL = 6;

/** A share icon that opens a QR code for `path` (relative to the site root). */
export function ShareButton({
  path,
  size = "sm",
  className,
}: {
  path: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <IconButton
        label={m.share_action()}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
      >
        <Share2 size={16} strokeWidth={2} />
      </IconButton>
      <ClientOnly>
        <ShareDialog open={open} path={path} onClose={() => setOpen(false)} />
      </ClientOnly>
    </>
  );
}

function ShareDialog({
  open,
  path,
  onClose,
}: {
  open: boolean;
  path: string;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const [svg, setSvg] = useState("");
  const [iconBroken, setIconBroken] = useState(false);
  // 二维码中间的徽标取「分享二维码徽标」，没单独设就跟标签页图标一致。
  const { siteConfig } = useRouteContext({ from: "__root__" });
  const badge = siteConfig.icons.shareBadge;

  useEffect(() => {
    if (!open) return;
    setUrl(`${window.location.origin}${encodeURI(path)}`);
  }, [open, path]);

  useEffect(() => {
    if (!open || !url) return;
    let cancelled = false;
    // uqr is only needed once the dialog opens, so it stays out of the page bundle.
    void import("uqr").then(({ renderSVG }) => {
      if (cancelled) return;
      setSvg(
        renderSVG(url, {
          // H 档可恢复 30% 数据，中间压一块徽标之后才扫得出来。
          ecc: "H",
          pixelSize: QR_PIXEL,
          border: 2,
          blackColor: "#111111",
          whiteColor: "#ffffff",
        }),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [open, url]);

  return (
    <FuwariModal
      open={open}
      onClose={onClose}
      label={m.share_title()}
      className="share-modal"
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold fuwari-text-90">
            {m.share_title()}
          </h2>
          <IconButton label={m.share_close()} onClick={onClose}>
            <X size={16} strokeWidth={2} />
          </IconButton>
        </div>

        <div className="share-qr mx-auto rounded-xl bg-white p-3">
          <div className="share-qr-frame">
            {svg ? (
              <div dangerouslySetInnerHTML={{ __html: svg }} />
            ) : (
              <div className="aspect-square w-full" />
            )}
            {svg && badge && !iconBroken ? (
              <span className="share-qr-badge">
                <img src={badge} alt="" onError={() => setIconBroken(true)} />
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-black/5 py-1 pr-1 pl-3 dark:bg-white/10">
          <span className="min-w-0 flex-1 truncate text-xs fuwari-text-50">
            {url}
          </span>
          <CopyButton
            text={url}
            label={m.share_copy()}
            copiedLabel={m.share_copied()}
          />
        </div>
      </div>
    </FuwariModal>
  );
}
