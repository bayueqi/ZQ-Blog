import { useQueryClient } from "@tanstack/react-query";
import { useBlocker, useNavigate } from "@tanstack/react-router";
import type { JSONContent, Editor as TiptapEditor } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAdminChrome } from "@/components/admin/admin-chrome";
import { Editor } from "@/components/tiptap-editor";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { extensions } from "@/features/posts/editor/config";
import { CodeBlockHighlightProvider } from "@/features/posts/editor/extensions/code-block/code-block-highlight-context";
import { postContentOf } from "@/features/posts/editor/extensions/image-placeholder";
import { postRevisionListQuery } from "@/features/posts/queries";
import { normalizePostContent } from "@/features/posts/utils/normalize-content";
import { m } from "@/paraglide/messages";
import { useDeletePost } from "../post-manager/hooks";
import { readPostListLocation } from "../post-manager/list-position";
import { useAutoSave, usePostActions } from "./hooks";
import { PostEditorHeader } from "./post-editor-header";
import { PostEditorMetadata } from "./post-editor-metadata";
import { PostEditorInfoPanel } from "./post-editor-info-panel";
import { PostEditorSummary } from "./post-editor-summary";
import type { PostEditorData, PostEditorProps } from "./types";

export function PostEditor({
  initialData,
  publicSlug,
  onSave,
}: PostEditorProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setPrimaryAction, setMobileTitle } = useAdminChrome();
  const [infoOpen, setInfoOpen] = useState(false);
  const [post, setPost] = useState<PostEditorData>(() => ({
    title: initialData.title,
    summary: initialData.summary,
    slug: initialData.slug,
    contentJson: normalizePostContent(initialData.contentJson) ?? null,
    publishedAt: initialData.publishedAt,
    pinnedAt: initialData.pinnedAt,
    tagIds: initialData.tagIds,
    categoryId: initialData.categoryId,
    hasPublicSnapshot: initialData.hasPublicSnapshot,
    serverToday: initialData.serverToday,
    coverMediaId: initialData.coverMediaId,
    cover: initialData.cover,
    visibility: initialData.visibility,
    privacyProtected: initialData.privacyProtected,
    accessPassword: "",
    hasAccessPassword: initialData.hasAccessPassword,
  }));
  // 点「完成」：开了密码访问却没设密码就拦下，先把密码填上。
  const closeInfo = useCallback(() => {
    if (
      post.visibility === "password" &&
      !post.hasAccessPassword &&
      !post.accessPassword.trim()
    ) {
      toast.error(m.editor_meta_access_password_required(), {
        id: "post-access-password-required",
      });
      return;
    }
    setInfoOpen(false);
  }, [post.accessPassword, post.hasAccessPassword, post.visibility]);

  // 点 X：直接关，密码没填就把密码访问关掉，不留个锁不住的开关。
  const dismissInfo = useCallback(() => {
    if (
      post.visibility === "password" &&
      !post.hasAccessPassword &&
      !post.accessPassword.trim()
    ) {
      setPost((prev) => ({
        ...prev,
        visibility: "public",
        privacyProtected: false,
        accessPassword: "",
      }));
    }
    setInfoOpen(false);
  }, [post.accessPassword, post.hasAccessPassword, post.visibility]);

  const [editorContent] = useState<JSONContent | null>(
    () => normalizePostContent(initialData.contentJson) ?? null,
  );
  const [contentEpoch, setContentEpoch] = useState(0);
  const [editorRenderKey] = useState(`editor:${initialData.id}`);

  const editorRef = useRef<TiptapEditor | null>(null);
  const editorContentRef = useRef(editorContent);
  editorContentRef.current = editorContent;

  const getContent = useCallback(() => {
    const editor = editorRef.current;
    if (editor && !editor.isDestroyed) {
      // Autosave and publish both save this.
      return postContentOf(editor.state.doc);
    }
    return editorContentRef.current;
  }, []);

  // 存过密码/清掉密码后同步本地标记，别让下面的必填判断停在旧状态。
  const handleSaveWithPasswordState = useCallback(
    async (data: PostEditorData) => {
      await onSave(data);
      setPost((prev) => {
        const next =
          data.visibility === "password"
            ? prev.hasAccessPassword || data.accessPassword.trim().length > 0
            : false;
        if (prev.hasAccessPassword === next) return prev;
        return { ...prev, hasAccessPassword: next };
      });
    },
    [onSave],
  );

  const {
    saveStatus,
    lastSaved,
    setError,
    flush,
    waitForInFlightSave,
    discardInFlightSave,
  } = useAutoSave({
    post,
    getContent,
    contentEpoch,
    onSave: handleSaveWithPasswordState,
  });

  // Unsaved edits of a deleted post have nowhere to go, so leave unguarded.
  const deletedRef = useRef(false);
  const { proceed, reset, status } = useBlocker({
    shouldBlockFn: () => !deletedRef.current && saveStatus !== "SYNCED",
    withResolver: true,
  });

  const deleteMutation = useDeletePost({
    onSuccess: () => {
      deletedRef.current = true;
      void navigate({ to: "/admin/posts", search: readPostListLocation() });
    },
  });
  const [settlingSave, setSettlingSave] = useState(false);
  const handleDelete = useCallback(async () => {
    setSettlingSave(true);
    discardInFlightSave();
    await waitForInFlightSave();
    setSettlingSave(false);
    deleteMutation.mutate({ id: initialData.id, title: post.title });
  }, [
    deleteMutation,
    discardInFlightSave,
    initialData.id,
    post.title,
    waitForInFlightSave,
  ]);

  const {
    isGeneratingSummary,
    handleGenerateSummary,
    handlePublish,
    handleUnpublish,
    processState,
    canPublish,
  } = usePostActions({
    postId: initialData.id,
    post,
    setPost,
    setError,
    flush,
    getContent,
  });

  const handleEditorCreated = useCallback((editor: TiptapEditor | null) => {
    editorRef.current = editor;
  }, []);

  const handleEditorUpdate = useCallback(() => {
    setContentEpoch((epoch) => epoch + 1);
  }, []);

  const handlePostChange = useCallback(
    (updates: Partial<PostEditorData>) => {
      setPost((prev) => ({ ...prev, ...updates }));
    },
    [setPost],
  );

  const openHistory = useCallback(async () => {
    try {
      await flush();
    } catch {
      toast.error(m.editor_status_save_error());
      return;
    }
    const revisions = await queryClient.ensureQueryData(
      postRevisionListQuery(initialData.id),
    );
    const desktop = window.matchMedia("(min-width: 1024px)").matches;
    if (desktop && revisions[0]) {
      await navigate({
        to: "/admin/posts/edit/$id/history/$revisionId",
        params: {
          id: String(initialData.id),
          revisionId: String(revisions[0].id),
        },
      });
      return;
    }
    await navigate({
      to: "/admin/posts/edit/$id/history",
      params: { id: String(initialData.id) },
    });
  }, [flush, initialData.id, navigate, queryClient]);

  const publishRef = useRef(handlePublish);
  publishRef.current = handlePublish;

  useEffect(() => {
    if (infoOpen) {
      setMobileTitle(m.editor_info_title());
      setPrimaryAction({
        label: m.editor_info_done(),
        onClick: closeInfo,
      });
    } else {
      setMobileTitle(post.title.trim() || m.common_untitled());
      setPrimaryAction({
        label:
          processState === "PROCESSING"
            ? m.editor_header_processing()
            : m.editor_header_publish(),
        onClick: () => {
          void publishRef.current();
        },
        disabled: processState !== "IDLE" || !canPublish,
      });
    }
  }, [
    canPublish,
    closeInfo,
    infoOpen,
    post.title,
    processState,
    setMobileTitle,
    setPrimaryAction,
  ]);

  useEffect(() => {
    return () => {
      setMobileTitle(null);
      setPrimaryAction(null);
    };
  }, [setMobileTitle, setPrimaryAction]);

  const metadata = (
    <PostEditorMetadata
      post={post}
      isGeneratingSummary={isGeneratingSummary}
      onPostChange={handlePostChange}
      onGenerateSummary={handleGenerateSummary}
    />
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <ConfirmationModal
        isOpen={status === "blocked"}
        onClose={() => reset?.()}
        onConfirm={() => proceed?.()}
        title={m.editor_leave_title()}
        message={m.editor_leave_message()}
        confirmLabel={m.editor_leave_confirm()}
      />

      <section className="post-editor-workspace fuwari-card-base">
        <PostEditorHeader
          saveStatus={saveStatus}
          lastSaved={lastSaved}
          processState={processState}
          canPublish={canPublish}
          hasPublicSnapshot={post.hasPublicSnapshot}
          publicSlug={post.hasPublicSnapshot ? publicSlug : null}
          title={post.title}
          onPublish={handlePublish}
          onUnpublish={handleUnpublish}
          onDelete={() => void handleDelete()}
          isDeleting={settlingSave || deleteMutation.isPending}
          infoOpen={infoOpen}
          onOpenInfo={() => setInfoOpen((value) => !value)}
          onOpenHistory={() => void openHistory()}
        />
        <div className="post-editor-body">
          <CodeBlockHighlightProvider
            snapshotContent={initialData.publicSnapshotContentJson}
          >
            <Editor
              key={editorRenderKey}
              className="post-editor-surface"
              toolbarClassName="post-editor-toolbar"
              documentClassName="post-editor-document custom-scrollbar"
              scrollContainerId="post-editor-scroll-container"
              contentClassName="min-h-50"
              documentHeader={
                <>
                  <TextareaTitle
                    value={post.title}
                    onChange={(title) => handlePostChange({ title })}
                  />
                  <PostEditorSummary
                    categoryId={post.categoryId}
                    tagIds={post.tagIds}
                    hasCover={Boolean(post.cover)}
                    onOpenInfo={() => setInfoOpen(true)}
                  />
                </>
              }
              extensions={extensions}
              content={editorContent ?? ""}
              onUpdate={handleEditorUpdate}
              onCreated={handleEditorCreated}
            />
          </CodeBlockHighlightProvider>
        </div>
        <PostEditorInfoPanel
          open={infoOpen}
          onClose={closeInfo}
          onDismiss={dismissInfo}
        >
          {metadata}
        </PostEditorInfoPanel>
      </section>
    </div>
  );
}

function TextareaTitle({
  value,
  onChange,
}: {
  value: string;
  onChange: (title: string) => void;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={1}
      placeholder={m.editor_title_placeholder()}
      aria-label={m.editor_title_placeholder()}
      className="post-editor-title w-full resize-none overflow-hidden bg-transparent fuwari-text-90 outline-none placeholder:fuwari-text-30"
      onInput={(event) => {
        const el = event.currentTarget;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      }}
      ref={(el) => {
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      }}
    />
  );
}
