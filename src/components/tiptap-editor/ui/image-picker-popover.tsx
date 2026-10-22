import type { Editor } from "@tiptap/react";
import { CornerDownLeft, Upload } from "lucide-react";
import { useId, useRef, useState } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Spinner } from "@/components/ui/spinner";
import { MediaPickerGrid } from "@/features/media/components/media-library/components";
import {
  useMediaPicker,
  useMediaUrlImport,
} from "@/features/media/components/media-library/hooks";
import type { MediaAsset } from "@/features/media/components/media-library/types";
import { ACCEPTED_IMAGE_TYPES } from "@/features/media/media.schema";
import { useImagePicker } from "@/features/posts/editor/extensions/image-placeholder";
import { m } from "@/paraglide/messages";
import { EditorPopover } from "./editor-popover";

const TABS = [
  { value: "upload", label: m.editor_image_tab_upload },
  { value: "link", label: m.editor_image_tab_link },
  { value: "library", label: m.editor_image_tab_library },
] as const;

type Tab = (typeof TABS)[number]["value"];

/**
 * The image picker below an image placeholder: upload a file, import an
 * image URL into the media library, or pick from the library. Picking puts
 * the image in the placeholder's place; Escape or a click elsewhere keeps the
 * placeholder.
 */
export function ImagePickerPopover({ editor }: { editor: Editor | null }) {
  const target = useImagePicker(editor);
  const open = target !== null;
  const [tab, setTab] = useState<Tab>("upload");
  const tabsRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const library = useMediaPicker(open);

  const fill = (asset: MediaAsset) => {
    editor
      ?.chain()
      .fillImagePlaceholder({
        src: asset.url,
        width: asset.width || undefined,
        height: asset.height || undefined,
      })
      .focus()
      .run();
  };

  return (
    <EditorPopover
      editor={editor}
      open={open}
      anchor={target}
      onClose={() => editor?.commands.closeImagePicker()}
      initialFocus={() =>
        tabsRef.current?.querySelector<HTMLElement>('[aria-selected="true"]') ??
        null
      }
      role="dialog"
      aria-label={m.editor_image_picker_title()}
      className="flex w-96 max-w-[calc(100vw-1rem)] flex-col gap-2 p-2"
    >
      <SegmentedControl
        ref={tabsRef}
        role="tablist"
        idBase={id}
        track={false}
        value={tab}
        onValueChange={setTab}
        items={TABS.map((item) => ({ value: item.value, label: item.label() }))}
      />
      <div
        role="tabpanel"
        id={`${id}-${tab}-panel`}
        aria-labelledby={`${id}-${tab}-tab`}
      >
        {tab === "upload" ? (
          <UploadPanel
            onFile={(file) => editor?.commands.uploadImageToPlaceholder(file)}
          />
        ) : tab === "link" ? (
          <LinkPanel known={library.mediaItems} onImport={fill} />
        ) : (
          <div className="max-h-72 overflow-y-auto p-1 custom-scrollbar">
            <MediaPickerGrid
              picker={library}
              onSelect={fill}
              columnsClassName="grid-cols-3"
            />
          </div>
        )}
      </div>
    </EditorPopover>
  );
}

function UploadPanel({ onFile }: { onFile: (file: File) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-(--fuwari-input-border) px-4 py-8 text-sm fuwari-text-50 transition-colors hover:border-(--fuwari-primary) hover:text-(--fuwari-primary)"
      >
        <Upload size={18} />
        {m.editor_image_upload_choose()}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
    </>
  );
}

function LinkPanel({
  known,
  onImport,
}: {
  known: ReadonlyArray<MediaAsset>;
  onImport: (asset: MediaAsset) => void;
}) {
  const [url, setUrl] = useState("");
  const { importUrl, importing } = useMediaUrlImport(known);

  const submit = async () => {
    if (importing) return;
    const asset = await importUrl(url);
    if (asset) onImport(asset);
  };

  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        inputMode="url"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
          event.preventDefault();
          void submit();
        }}
        aria-label={m.editor_image_url()}
        placeholder="https://"
        disabled={importing}
        className="h-8 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-sm fuwari-text-90 outline-none placeholder:fuwari-text-30"
      />
      <IconButton
        label={m.editor_image_import()}
        onClick={() => void submit()}
        disabled={importing || !url.trim()}
      >
        {importing ? <Spinner size={14} /> : <CornerDownLeft size={14} />}
      </IconButton>
    </div>
  );
}
