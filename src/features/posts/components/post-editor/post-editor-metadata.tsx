import { RefreshCw } from "lucide-react";
import type { ComponentProps } from "react";
import TextareaAutosize from "react-textarea-autosize";
import DatePicker from "@/components/ui/date-picker";
import { FormField } from "@/components/ui/form-field";
import { PasswordInput } from "@/components/ui/password-input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { CategorySelect } from "@/features/categories/components/category-select";
import { TagSelector } from "@/features/tags/components/tag-selector";
import { m } from "@/paraglide/messages";
import { PostEditorCover } from "./post-editor-cover";
import type { PostEditorData } from "./types";

interface PostEditorMetadataProps {
  post: PostEditorData;
  isGeneratingSlug: boolean;
  onPostChange: (updates: Partial<PostEditorData>) => void;
  onGenerateSlug: () => void;
}

export function PostEditorMetadata({
  post,
  isGeneratingSlug,
  onPostChange,
  onGenerateSlug,
}: PostEditorMetadataProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 custom-scrollbar">
        <PostEditorCover
          cover={post.cover}
          onChange={(next) => onPostChange(next)}
        />

        <FormField label={m.editor_meta_category()}>
          <CategorySelect
            value={post.categoryId}
            onChange={(categoryId) => onPostChange({ categoryId })}
          />
        </FormField>

        <FormField label={m.editor_meta_tags()}>
          <TagSelector
            value={post.tagIds}
            onChange={(tagIds) => onPostChange({ tagIds })}
          />
        </FormField>

        <FormField label={m.editor_meta_link()}>
          <SlugInput
            value={post.slug || ""}
            onChange={(e) => onPostChange({ slug: e.target.value })}
            generating={isGeneratingSlug}
            onGenerate={onGenerateSlug}
          />
        </FormField>

        <div className="flex items-end gap-3">
          <FormField label={m.editor_meta_date()} className="min-w-0 flex-1">
            <DatePicker
              today={post.serverToday}
              maxDate={post.serverToday}
              value={
                post.publishedAt
                  ? post.publishedAt.toISOString().slice(0, 10)
                  : ""
              }
              onChange={(dateStr) => {
                if (dateStr && dateStr > post.serverToday) return;
                onPostChange({
                  publishedAt: dateStr
                    ? new Date(`${dateStr}T12:00:00Z`)
                    : null,
                });
              }}
            />
          </FormField>
          <Switch
            label={m.editor_meta_pin()}
            checked={Boolean(post.pinnedAt)}
            onCheckedChange={(pinned) =>
              onPostChange({ pinnedAt: pinned ? new Date() : null })
            }
            className="min-h-10 w-auto text-sm"
          />
        </div>

        <div className="space-y-3">
          <Switch
            label={m.editor_meta_visibility_password()}
            checked={post.visibility === "password"}
            onCheckedChange={(locked) =>
              onPostChange({ visibility: locked ? "password" : "public" })
            }
            className="min-h-10 w-auto text-sm"
          />
          {post.visibility === "password" && (
            <FormField label={m.editor_meta_access_password()}>
              <PasswordInput
                secret
                value={post.accessPassword}
                placeholder={
                  post.hasAccessPassword
                    ? m.editor_meta_access_password_keep()
                    : m.editor_meta_access_password_placeholder()
                }
                onChange={(event) =>
                  onPostChange({ accessPassword: event.target.value })
                }
              />
            </FormField>
          )}
        </div>

        <FormField label={m.editor_meta_summary()}>
          <TextareaAutosize
            value={post.summary || ""}
            onChange={(e) => onPostChange({ summary: e.target.value })}
            placeholder={m.editor_summary_placeholder()}
            minRows={3}
            className="fuwari-input resize-none"
          />
        </FormField>
      </div>
    </div>
  );
}

function SlugInput({
  generating,
  onGenerate,
  ...props
}: ComponentProps<"input"> & {
  generating: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="fuwari-field-shell gap-1">
      <span className="shrink-0">/post/</span>
      <input type="text" placeholder="your-post-slug" {...props} />
      <button
        type="button"
        onClick={() => {
          if (!generating) onGenerate();
        }}
        aria-disabled={generating}
        className="fuwari-field-button"
        aria-label={m.editor_meta_auto_generate()}
      >
        {generating ? <Spinner size={14} /> : <RefreshCw size={14} />}
      </button>
    </div>
  );
}
