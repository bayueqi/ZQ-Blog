import type { Ref } from "react";
import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { videoProviderName } from "@/features/posts/components/content/video-embed";
import type { VideoSource } from "@/features/posts/utils/video-source";
import { parseVideoInput } from "@/features/posts/utils/video-source";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

export interface VideoEditorPanelProps {
  /** The link to start from. */
  link: string;
  /** Whether the video was just inserted, which names the apply button. */
  inserted: boolean;
  onApply: (source: VideoSource) => void;
  onCancel: () => void;
  inputRef?: Ref<HTMLInputElement>;
}

/**
 * Takes a video page link or a provider's embed code and says, as it is
 * typed, which video it found or why it found none. Enter applies a found
 * video, Escape cancels.
 */
export function VideoEditorPanel({
  link,
  inserted,
  onApply,
  onCancel,
  inputRef,
}: VideoEditorPanelProps) {
  const statusId = useId();
  const [value, setValue] = useState(link);
  const input = useMemo(() => parseVideoInput(value), [value]);
  const source = input.kind === "video" ? input.source : null;
  const apply = () => {
    if (source) onApply(source);
  };

  let status: string;
  if (source) {
    status = m.editor_video_recognized({
      provider: videoProviderName(source.provider),
      video: source.videoId + (source.page ? ` · P${source.page}` : ""),
    });
  } else if (!value.trim()) {
    status = m.editor_video_hint();
  } else if (input.kind === "shortLink") {
    status = m.editor_video_short_link();
  } else {
    status = m.editor_video_unsupported();
  }

  return (
    <div
      data-video-editor=""
      className="flex flex-col gap-2 text-left [--fuwari-field-font-size:13px] [--fuwari-field-height:36px] [--fuwari-field-radius:8px]"
    >
      <Input
        ref={inputRef}
        type="text"
        aria-label={m.editor_video_input()}
        aria-describedby={statusId}
        value={value}
        spellCheck={false}
        placeholder={m.editor_video_placeholder()}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          } else if (event.key === "Enter") {
            event.preventDefault();
            apply();
          }
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <p
          id={statusId}
          role="status"
          className={cn(
            "mr-auto min-w-0 text-xs",
            source
              ? "text-(--fuwari-primary)"
              : value.trim()
                ? "text-(--fuwari-danger-fg)"
                : "fuwari-text-50",
          )}
        >
          {status}
        </p>
        <Button size="sm" onClick={onCancel}>
          {m.common_cancel()}
        </Button>
        <Button variant="primary" size="sm" onClick={apply} disabled={!source}>
          {inserted ? m.editor_video_insert() : m.editor_video_update()}
        </Button>
      </div>
    </div>
  );
}
