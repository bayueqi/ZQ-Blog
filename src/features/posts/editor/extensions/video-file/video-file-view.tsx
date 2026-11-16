import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

export function VideoFileView({ node, selected }: NodeViewProps) {
  const src = node.attrs.src as string | null;
  const poster = node.attrs.poster as string | null;
  const isUploading = Boolean(node.attrs.uploadId || src?.startsWith("blob:"));

  return (
    <NodeViewWrapper className="not-prose relative my-8 outline-none">
      <div
        className={cn(
          "relative overflow-hidden rounded-xl bg-black p-1",
          selected && "ring-2 ring-(--fuwari-primary)",
        )}
      >
        {src ? (
          <video
            src={src}
            poster={poster ?? undefined}
            controls
            playsInline
            preload="metadata"
            contentEditable={false}
            className="mx-auto block max-h-[70vh] w-full bg-black object-contain"
          />
        ) : null}

        {isUploading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="flex items-center gap-2 rounded-xl bg-(--fuwari-card-bg) px-3 py-2 text-sm fuwari-text-50 shadow-md">
              <Spinner size={14} />
              <span>{m.media_upload_status_uploading()}</span>
            </div>
          </div>
        ) : null}
      </div>
    </NodeViewWrapper>
  );
}
