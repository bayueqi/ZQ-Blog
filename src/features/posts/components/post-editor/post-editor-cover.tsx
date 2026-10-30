import { Image as ImageIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MediaPicker } from "@/features/media/components/media-library/components";
import { m } from "@/paraglide/messages";
import type { PostEditorData } from "./types";

type CoverValue = NonNullable<PostEditorData["cover"]>;

function toCover(media: {
  id: number;
  key: string;
  url: string;
  fileName: string;
  width: number | null;
  height: number | null;
}): CoverValue {
  return {
    id: media.id,
    key: media.key,
    url: media.url,
    fileName: media.fileName,
    width: media.width,
    height: media.height,
  };
}

export function PostEditorCover({
  cover,
  onChange,
}: {
  cover: CoverValue | null;
  onChange: (next: {
    coverMediaId: number | null;
    cover: CoverValue | null;
  }) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="space-y-2">
      <p className="text-xs fuwari-text-50">{m.editor_meta_cover()}</p>
      <div
        className={
          cover
            ? "relative aspect-video overflow-hidden rounded-xl bg-(--fuwari-btn-regular-bg)"
            : "flex items-center justify-between gap-3"
        }
      >
        {cover ? (
          <img
            src={cover.url}
            alt={cover.fileName}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex items-center gap-2 text-sm fuwari-text-50">
            <ImageIcon size={16} strokeWidth={1.5} />
            {m.editor_meta_cover_empty()}
          </span>
        )}
        <div
          className={
            cover
              ? "absolute right-2 bottom-2 flex gap-1.5"
              : "flex shrink-0 gap-1.5"
          }
        >
          <Button
            size="sm"
            variant={cover ? "overlay" : "regular"}
            onClick={() => setPickerOpen(true)}
          >
            {cover ? m.editor_meta_cover_change() : m.editor_meta_cover_pick()}
          </Button>
          {cover ? (
            <Button
              size="sm"
              variant="overlay"
              onClick={() => onChange({ coverMediaId: null, cover: null })}
            >
              {m.editor_meta_cover_clear()}
            </Button>
          ) : null}
        </div>
      </div>
      <MediaPicker
        open={pickerOpen}
        title={m.editor_meta_cover_pick()}
        onClose={() => setPickerOpen(false)}
        onSelect={(media) => {
          onChange({
            coverMediaId: media.id,
            cover: toCover(media),
          });
          setPickerOpen(false);
        }}
      />
    </div>
  );
}
