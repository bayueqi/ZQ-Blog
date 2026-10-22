import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { PostEditorData } from "@/features/posts/components/post-editor/types";
import { slugify } from "@/features/posts/utils/content";
import { orpcClient } from "@/lib/orpc";
import { useDebounce } from "@/hooks/use-debounce";
import { m } from "@/paraglide/messages";
import {
  invalidatePostQueries,
  useUnpublishPost,
} from "../../post-manager/hooks";
import {
  BLOB_UPLOADING_ERROR,
  shouldAutogenerateSlug,
} from "../post-editor.model";

interface UsePostActionsOptions {
  postId: number;
  post: PostEditorData;
  setPost: React.Dispatch<React.SetStateAction<PostEditorData>>;
  setError: (error: string | null) => void;
  flush: () => Promise<void>;
}

export function usePostActions({
  postId,
  post,
  setPost,
  setError,
  flush,
}: UsePostActionsOptions) {
  const queryClient = useQueryClient();

  const [processState, setProcessState] = useState<
    "IDLE" | "PROCESSING" | "SUCCESS"
  >("IDLE");

  const canPublish = useMemo(() => {
    if (!post.publishedAt) return true;
    return post.publishedAt.toISOString().slice(0, 10) <= post.serverToday;
  }, [post.publishedAt, post.serverToday]);

  const lastAutoSlugRef = useRef<string | null>(null);
  const queuedTitleRef = useRef<string | null>(null);
  const prevTitleRef = useRef(post.title);
  const isFirstTitleMount = useRef(true);
  const slugGenerationMode = useRef<"manual" | "auto">("manual");
  const latestSlugRef = useRef(post.slug);
  const latestTitleRef = useRef(post.title);
  const publishedRef = useRef(false);
  latestSlugRef.current = post.slug;
  latestTitleRef.current = post.title;
  // `publishedAt` arrives on reload after the first publish and survives an
  // unpublish; `hasPublicSnapshot` covers the session that first publishes.
  publishedRef.current = post.hasPublicSnapshot || post.publishedAt !== null;
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
  }, [flush, processState, publishMutation]);

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
      lastAutoSlugRef.current = result.slug;
      setPost((prev) => ({ ...prev, slug: result.slug }));
      if (slugGenerationMode.current === "manual") {
        toast.success(m.editor_action_slug_set(), {
          description: m.editor_action_slug_set_desc({ slug: result.slug }),
        });
      }
    },
    onSettled: (_data, error) => {
      if (error) {
        console.error("Slug generation failed:", error);
        setError(m.editor_action_slug_error());
        const fallbackSlug = slugify(latestTitleRef.current) || "untitled-log";
        lastAutoSlugRef.current = fallbackSlug;
        setPost((prev) => ({ ...prev, slug: fallbackSlug }));
      }
      const queuedTitle = queuedTitleRef.current;
      queuedTitleRef.current = null;
      if (
        queuedTitle &&
        shouldAutogenerateSlug(
          latestSlugRef.current,
          lastAutoSlugRef.current,
          publishedRef.current,
        )
      ) {
        slugGenerationMode.current = "auto";
        slugMutation.mutate(queuedTitle);
      }
    },
  });

  const lockSlug = () => {
    lastAutoSlugRef.current = null;
  };

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
    if (
      !shouldAutogenerateSlug(
        latestSlugRef.current,
        lastAutoSlugRef.current,
        publishedRef.current,
      )
    ) {
      return;
    }
    if (slugMutation.isPending) {
      queuedTitleRef.current = debouncedTitle;
      return;
    }
    slugGenerationMode.current = "auto";
    slugMutation.mutate(debouncedTitle);
  }, [debouncedTitle, slugMutation]);

  const handleGenerateSlug = () => {
    if (!post.title.trim()) {
      setError(m.editor_action_title_empty());
      return;
    }
    slugGenerationMode.current = "manual";
    slugMutation.mutate(post.title);
  };

  return {
    isGeneratingSlug: slugMutation.isPending,
    handleGenerateSlug,
    handlePublish,
    handleUnpublish,
    processState,
    canPublish,
    lockSlug,
  };
}
