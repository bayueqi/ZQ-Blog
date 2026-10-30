import { ClientOnly } from "@tanstack/react-router";
import { ImagePlus, X } from "lucide-react";
import { useRef, useState, type FormEvent, type RefObject } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { FuwariModal } from "@/components/ui/fuwari-modal";
import { IconButton } from "@/components/ui/icon-button";
import { Input, Textarea } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Switch } from "@/components/ui/switch";
import type { GalleryCategoryCard } from "@/features/gallery/gallery.schema";
import { MediaPicker } from "@/features/media/components/media-library/components";
import {
  getPublicImageSrc,
  PUBLIC_IMAGE_WIDTH,
} from "@/features/media/utils/media.utils";
import { orpcClient } from "@/lib/orpc";
import { m } from "@/paraglide/messages";
import "./gallery-dialogs.css";

type Cover = GalleryCategoryCard["cover"];

export type GalleryCategoryRow = GalleryCategoryCard & {
  hasAccessPassword: boolean;
};

function CoverField({
  cover,
  buttonRef,
  onPick,
}: {
  cover: Cover;
  buttonRef: RefObject<HTMLButtonElement | null>;
  onPick: () => void;
}) {
  return (
    <div className="fuwari-form-field">
      <div className="fuwari-form-field-label">
        <label>{m.admin_gallery_cover()}</label>
      </div>
      <div className="gallery-cover-row">
        <div className="gallery-cover-preview">
          {cover ? (
            <img
              src={getPublicImageSrc(cover.url, PUBLIC_IMAGE_WIDTH.avatar)}
              alt=""
            />
          ) : (
            <ImagePlus size={20} strokeWidth={1.5} />
          )}
        </div>
        <Button ref={buttonRef} variant="regular" onClick={onPick}>
          {m.admin_gallery_pick_cover()}
        </Button>
      </div>
    </div>
  );
}

/** 新建或编辑一个相册集。 */
export function GalleryCategoryDialog({
  open,
  row,
  onClose,
  onSaved,
}: {
  open: boolean;
  row: GalleryCategoryRow | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(row?.name ?? "");
  const [description, setDescription] = useState(row?.description ?? "");
  const [password, setPassword] = useState("");
  const [passwordProtected, setPasswordProtected] = useState(
    Boolean(row?.hasAccessPassword),
  );
  const [privacy, setPrivacy] = useState(Boolean(row?.privacyProtected));
  // 新建时默认发布，编辑时沿用原来的状态。
  const [published, setPublished] = useState(row?.published ?? true);
  const [cover, setCover] = useState<Cover>(row?.cover ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLButtonElement>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      // 关掉开关就清掉密码；开着但不填则维持原密码。
      const passwordField = passwordProtected
        ? password
          ? { password }
          : {}
        : { password: null };
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        coverMediaId: cover?.id ?? null,
        privacyProtected: passwordProtected && privacy,
        published,
        ...passwordField,
      };
      if (row) {
        await orpcClient.gallery.admin.categories.update({
          id: row.id,
          ...payload,
        });
      } else {
        await orpcClient.gallery.admin.categories.create(payload);
      }
      toast.success(m.admin_gallery_saved());
      await onSaved();
      onClose();
    } catch {
      toast.error(m.admin_gallery_failed());
    } finally {
      setSaving(false);
    }
  }

  return (
    <ClientOnly>
      <FuwariModal
        open={open}
        onClose={onClose}
        busy={saving}
        label={row ? m.admin_gallery_edit() : m.admin_gallery_new()}
        className="gallery-dialog"
        initialFocus={() => nameRef.current}
        returnFocus={() => coverRef.current}
      >
        <header className="gallery-dialog-header">
          <h2>{row ? m.admin_gallery_edit() : m.admin_gallery_new()}</h2>
          <IconButton
            label={m.common_close()}
            disabled={saving}
            onClick={onClose}
          >
            <X size={18} />
          </IconButton>
        </header>

        <form className="gallery-dialog-form" onSubmit={submit}>
          <FormField label={m.admin_gallery_name()} required>
            <Input
              ref={nameRef}
              value={name}
              maxLength={80}
              autoComplete="off"
              onChange={(event) => setName(event.target.value)}
            />
          </FormField>
          <FormField label={m.admin_gallery_description()}>
            <Textarea
              value={description}
              rows={3}
              maxLength={500}
              onChange={(event) => setDescription(event.target.value)}
            />
          </FormField>
          <CoverField
            cover={cover}
            buttonRef={coverRef}
            onPick={() => setPickerOpen(true)}
          />
          <Switch
            label={m.admin_gallery_published()}
            checked={published}
            onCheckedChange={setPublished}
            className="min-h-10 w-auto text-sm"
          />
          <Switch
            label={m.editor_meta_visibility_password()}
            checked={passwordProtected}
            onCheckedChange={setPasswordProtected}
            className="min-h-10 w-auto text-sm"
          />
          {passwordProtected ? (
            <>
              <FormField label={m.admin_gallery_password()}>
                <PasswordInput
                  value={password}
                  maxLength={100}
                  secret
                  autoComplete="new-password"
                  placeholder={
                    row?.hasAccessPassword
                      ? m.editor_meta_access_password_keep()
                      : m.editor_meta_access_password_placeholder()
                  }
                  onChange={(event) => setPassword(event.target.value)}
                />
              </FormField>
              <Switch
                label={m.editor_meta_privacy()}
                checked={privacy}
                onCheckedChange={setPrivacy}
                className="min-h-10 w-auto text-sm"
              />
              {privacy ? (
                <p className="text-xs fuwari-text-50">
                  {m.admin_gallery_privacy_hint()}
                </p>
              ) : null}
            </>
          ) : null}

          <footer className="gallery-dialog-footer">
            <Button onClick={onClose} disabled={saving}>
              {m.admin_gallery_cancel()}
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              disabled={saving || !name.trim()}
            >
              {m.admin_gallery_save()}
            </Button>
          </footer>
        </form>

        <MediaPicker
          open={pickerOpen}
          title={m.admin_gallery_pick_cover()}
          onClose={() => setPickerOpen(false)}
          returnFocus={() => coverRef.current}
          onSelect={(media) => {
            setCover({
              id: media.id,
              url: media.url,
              width: media.width,
              height: media.height,
            });
            setPickerOpen(false);
          }}
        />
      </FuwariModal>
    </ClientOnly>
  );
}
