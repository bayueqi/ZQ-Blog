import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { JSONContent } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { PostEditorData } from "@/features/posts/components/post-editor/types";
import { convertToPlainText, slugify } from "@/features/posts/utils/content";
import { orpcClient } from "@/lib/orpc";
import { useDebounce } from "@/hooks/use-debounce";
import { m } from "@/paraglide/messages";
import {
  invalidatePostQueries,
  useUnpublishPost,
} from "../../post-manager/hooks";
import { BLOB_UPLOADING_ERROR } from "../post-editor.model";

interface UsePostActionsOptions {
  postId: number;
  post: PostEditorData;
  setPost: React.Dispatch<React.SetStateAction<PostEditorData>>;
  setError: (error: string | null) => void;
  flush: () => Promise<void>;
  getContent: () => JSONContent | null;
}

export function usePostActions({
  postId,
  post,
  setPost,
  setError,
  flush,
  getContent,
}: UsePostActionsOptions) {
  const queryClient = useQueryClient();

  const [processState, setProcessState] = useState<
    "IDLE" | "PROCESSING" | "SUCCESS"
  >("IDLE");

  const canPublish = useMemo(() => {
    if (!post.publishedAt) return true;
    return post.publishedAt.toISOString().slice(0, 10) <= post.serverToday;
  }, [post.publishedAt, post.serverToday]);

  const queuedTitleRef = useRef<string | null>(null);
  const prevTitleRef = useRef(post.title);
  const isFirstTitleMount = useRef(true);
  const latestTitleRef = useRef(post.title);
  latestTitleRef.current = post.title;
  const debouncedTitle = useDebounce(post.title, 500);

  const publishMutation = useMutation({
    mutationFn: () => orpcClient.posts.admin.publish({ id: postId }),
    onSuccess: () => {
      toast.success(m.editor_header_publish());
      setPost((prev) => ({ ...prev, hasPublicSnapshot: true }));
      setProcessState("SUCCESS");
      void invalidatePostQueries(queryClient, postId);
      setTimeout(() => {
        setProcessState("IDLE");
      }, 3000);
    },
    onError: () => {
      toast.error(m.editor_action_publish_failed());
      setProcessState("IDLE");
    },
  });

  const { mutate: unpublish } = useUnpublishPost({
    onSuccess: () => {
      setPost((prev) => ({ ...prev, hasPublicSnapshot: false }));
      setProcessState("SUCCESS");
      setTimeout(() => {
        setProcessState("IDLE");
      }, 3000);
    },
    onError: () => setProcessState("IDLE"),
  });

  const handlePublish = useCallback(async () => {
    if (processState !== "IDLE") return;
    // 开了密码访问还没填密码，先在发布这一下拦住并说清楚。
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
    setProcessState("PROCESSING");
    try {
      await flush();
    } catch (error) {
      const message =
        error instanceof Error && error.message === BLOB_UPLOADING_ERROR
          ? m.editor_action_image_uploading()
          : m.editor_action_publish_failed();
      toast.error(message);
      setProcessState("IDLE");
      return;
    }
    publishMutation.mutate();
  }, [
    flush,
    post.accessPassword,
    post.hasAccessPassword,
    post.visibility,
    processState,
    publishMutation,
  ]);

  const handleUnpublish = useCallback(() => {
    if (processState !== "IDLE") return;
    setProcessState("PROCESSING");
    unpublish(postId);
  }, [postId, processState, unpublish]);

  const slugMutation = useMutation({
    mutationFn: (title: string) =>
      orpcClient.posts.admin.generateSlug({
        title,
        excludeId: postId,
      }),
    onSuccess: (result) => {
      setPost((prev) => ({ ...prev, slug: result.slug }));
    },
    onSettled: (_data, error) => {
      if (error) {
        console.error("Slug generation failed:", error);
        setError(m.editor_action_slug_error());
        const fallbackSlug = slugify(latestTitleRef.current) || "untitled-log";
        setPost((prev) => ({ ...prev, slug: fallbackSlug }));
      }
      const queuedTitle = queuedTitleRef.current;
      queuedTitleRef.current = null;
      if (queuedTitle) {
        slugMutation.mutate(queuedTitle);
      }
    },
  });

  const summaryMutation = useMutation({
    mutationFn: (contentJson: JSONContent) =>
      orpcClient.posts.admin.generateSummary({ contentJson }),
    onSuccess: (result) => {
      setPost((prev) => ({ ...prev, summary: result.summary }));
    },
    onError: (error) => {
      console.error("Summary generation failed:", error);
      toast.error(m.editor_action_summary_error());
    },
  });

  // 链接始终由标题生成：标题改了，链接跟着改。
  useEffect(() => {
    if (isFirstTitleMount.current) {
      isFirstTitleMount.current = false;
      prevTitleRef.current = debouncedTitle;
      return;
    }

    if (debouncedTitle === prevTitleRef.current) {
      return;
    }
    prevTitleRef.current = debouncedTitle;

    if (!debouncedTitle.trim()) {
      return;
    }
    if (slugMutation.isPending) {
      queuedTitleRef.current = debouncedTitle;
      return;
    }
    slugMutation.mutate(debouncedTitle);
  }, [debouncedTitle, slugMutation]);

  const handleGenerateSummary = () => {
    const contentJson = getContent();
    if (!contentJson || !convertToPlainText(contentJson).trim()) {
      toast.error(m.editor_action_no_content(), {
        description: m.editor_action_no_content_summary(),
      });
      return;
    }
    summaryMutation.mutate(contentJson);
  };

  return {
    isGeneratingSummary: summaryMutation.isPending,
    handleGenerateSummary,
    handlePublish,
    handleUnpublish,
    processState,
    canPublish,
  };
}
