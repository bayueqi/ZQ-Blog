import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, LockKeyhole, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { useAdminChrome } from "@/components/admin/admin-chrome";
import { Button, buttonClass } from "@/components/ui/button";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { SectionHeading } from "@/components/ui/page-heading";
import { postRevisionListQuery } from "@/features/posts/queries";
import { formatMonthDayTime } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { usePostHistory } from "./hooks";
import { PostEditorHistoryDocument } from "./post-editor-history-document";
import { PostEditorHistoryList } from "./post-editor-history-list";

export function PostHistoryPage({
  postId,
  revisionId,
}: {
  postId: number;
  revisionId: number;
}) {
  const navigate = useNavigate();
  const { setPrimaryAction, setMobileTitle } = useAdminChrome();

  const goEditor = () => {
    void navigate({
      to: "/admin/posts/edit/$id",
      params: { id: String(postId) },
    });
  };

  const goRevision = (nextId: number | null) => {
    if (nextId == null) {
      void navigate({
        to: "/admin/posts/edit/$id/history",
        params: { id: String(postId) },
      });
      return;
    }
    void navigate({
      to: "/admin/posts/edit/$id/history/$revisionId",
      params: { id: String(postId), revisionId: String(nextId) },
    });
  };

  const history = usePostHistory({
    postId,
    selectedRevisionId: revisionId,
    onRestored: goEditor,
    onDeleted: goRevision,
  });

  const viewingTime = history.selectedRevision
    ? formatMonthDayTime(history.selectedRevision.createdAt)
    : "";

  const restoreRef = useRef(history.requestRestore);
  restoreRef.current = history.requestRestore;
  const canRestore =
    history.selectedRevision != null &&
    !history.isRestoring &&
    !history.isDeleting;

  useEffect(() => {
    setMobileTitle(m.editor_history_list_title());
    setPrimaryAction({
      label: m.editor_history_restore_this(),
      onClick: () => restoreRef.current(),
      disabled: !canRestore,
    });
  }, [canRestore, setMobileTitle, setPrimaryAction]);

  useEffect(() => {
    return () => {
      setMobileTitle(null);
      setPrimaryAction(null);
    };
  }, [setMobileTitle, setPrimaryAction]);

  const deleteAction = (
    <Button
      variant="plain"
      tone="danger"
      size="sm"
      onClick={history.requestDelete}
      disabled={!canRestore}
      loading={history.isDeleting}
      icon={<Trash2 size={15} />}
      className="post-history-delete"
    >
      {m.editor_history_delete_action()}
    </Button>
  );

  return (
    <div className="post-editor-workspace fuwari-card-base">
      <ConfirmationModal
        isOpen={history.confirm === "restore"}
        onClose={history.cancelConfirm}
        onConfirm={history.confirmRestore}
        title={m.editor_history_restore_title()}
        message={m.editor_history_restore_message()}
        confirmLabel={m.editor_history_restore_action()}
        isLoading={history.isRestoring}
      />
      <ConfirmationModal
        isOpen={history.confirm === "delete"}
        onClose={history.cancelConfirm}
        onConfirm={history.confirmDelete}
        title={m.editor_history_delete_title()}
        message={m.editor_history_delete_message()}
        confirmLabel={m.editor_history_delete_action()}
        isLoading={history.isDeleting}
        isDanger
      />

      <header className="post-editor-header post-history-header">
        <Link
          to="/admin/posts/edit/$id"
          params={{ id: String(postId) }}
          className="post-editor-back"
        >
          <ArrowLeft size={17} />
          {m.editor_history_back()}
        </Link>
        <div className="post-history-context">
          <LockKeyhole size={17} />
          <div>
            <h1>{m.editor_history_readonly()}</h1>
            <p>{m.editor_history_restore_hint()}</p>
          </div>
        </div>
        <div className="post-editor-header-actions">
          <Link
            to="/admin/posts/edit/$id/history"
            params={{ id: String(postId) }}
            className={buttonClass({
              variant: "plain",
              className: "lg:hidden",
            })}
          >
            {m.editor_history_list_title()}
          </Link>
          <Button
            variant="primary"
            onClick={history.requestRestore}
            disabled={!canRestore}
            loading={history.isRestoring}
            className="hidden lg:inline-flex"
          >
            {m.editor_history_restore_this()}
          </Button>
        </div>
      </header>
      <div className="post-history-body">
        <section className="post-history-content">
          <PostEditorHistoryDocument
            snapshot={history.selectedRevision?.snapshotJson ?? null}
            isLoading={history.isRevisionLoading}
            editorKey={`history:${postId}:${revisionId}`}
            viewingTime={viewingTime}
          />
        </section>
        <aside
          className="post-history-sidebar"
          aria-label={m.editor_history_list_title()}
        >
          <SectionHeading
            className="post-editor-panel-heading"
            size="sm"
            title={m.editor_history_list_title()}
          />
          <PostEditorHistoryList
            postId={postId}
            revisions={history.revisions}
            isLoading={history.isListLoading}
            selectedRevisionId={revisionId}
          />
          {deleteAction}
        </aside>
      </div>
      <div className="lg:hidden">{deleteAction}</div>
    </div>
  );
}

export function PostHistoryIndex({ postId }: { postId: number }) {
  const { setPrimaryAction, setMobileTitle } = useAdminChrome();
  const { data: revisions = [], isLoading } = useQuery(
    postRevisionListQuery(postId),
  );

  useEffect(() => {
    setMobileTitle(m.editor_history_list_title());
    setPrimaryAction(null);
    return () => {
      setMobileTitle(null);
    };
  }, [setMobileTitle, setPrimaryAction]);

  return (
    <div className="post-editor-workspace fuwari-card-base">
      <div className="post-editor-header">
        <Link
          to="/admin/posts/edit/$id"
          params={{ id: String(postId) }}
          className="post-editor-back inline-flex"
        >
          <ArrowLeft size={17} />
          {m.editor_history_back()}
        </Link>
      </div>
      <h1 className="hidden px-5 pb-2 text-2xl font-medium fuwari-text-90 lg:block">
        {m.editor_history_list_title()}
      </h1>
      <PostEditorHistoryList
        postId={postId}
        revisions={revisions}
        isLoading={isLoading}
        selectedRevisionId={null}
      />
    </div>
  );
}
