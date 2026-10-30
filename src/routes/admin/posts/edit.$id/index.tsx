import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { StatusPage } from "@/components/common/status-page";
import { buttonClass } from "@/components/ui/button";
import { PostEditor } from "@/features/posts/components/post-editor";
import { persistableTagIds } from "@/features/posts/components/post-editor/post-editor.model";
import { PostEditorSkeleton } from "@/features/posts/components/post-editor/post-editor-skeleton";
import type { PostEditorData } from "@/features/posts/components/post-editor/types";
import { postByIdQuery } from "@/features/posts/queries";
import { categoryOptionsQuery } from "@/features/categories/queries";
import {
  tagsAdminQueryOptions,
  tagsByPostIdQueryOptions,
} from "@/features/tags/queries";
import { orpc, orpcClient } from "@/lib/orpc";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/admin/posts/edit/$id/")({
  ssr: "data-only",
  component: EditPost,
  pendingComponent: PostEditorSkeleton,
  loader: async ({ context, params }) => {
    const postId = Number(params.id);
    const [post] = await Promise.all([
      context.queryClient.ensureQueryData(postByIdQuery(postId)),
      context.queryClient.ensureQueryData(tagsByPostIdQueryOptions(postId)),
      context.queryClient.prefetchQuery(tagsAdminQueryOptions()),
      context.queryClient.prefetchQuery(categoryOptionsQuery),
    ]);
    return { title: post?.title };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.title,
      },
    ],
  }),
});

function EditPost() {
  const { id } = Route.useParams();
  const postId = Number(id);
  const queryClient = useQueryClient();

  const { data: post } = useQuery(postByIdQuery(postId));
  const { data: tags } = useQuery(tagsByPostIdQueryOptions(postId));

  if (!post || !tags) {
    return (
      <StatusPage
        title={m.admin_post_edit_not_found_title()}
        description={m.admin_post_edit_not_found_desc({ id: String(postId) })}
        action={
          <Link
            to="/admin/posts"
            className={buttonClass({ variant: "primary", size: "lg" })}
          >
            {m.common_back()}
          </Link>
        }
      />
    );
  }

  const initialData = {
    id: post.id,
    title: post.title,
    summary: post.summary ?? "",
    slug: post.slug,
    contentJson: post.contentJson,
    publishedAt: post.publishedAt,
    tagIds: tags.map((t) => t.id),
    categoryId: post.categoryId ?? null,
    pinnedAt: post.pinnedAt,
    hasPublicSnapshot: post.hasPublicSnapshot,
    publicSnapshotContentJson: post.publicSnapshotContentJson,
    serverToday: post.serverToday,
    coverMediaId: post.coverMediaId,
    cover: post.cover,
    visibility: post.visibility,
    privacyProtected: post.privacyProtected,
    hasAccessPassword: post.hasAccessPassword,
  };

  const handleSave = async (data: PostEditorData) => {
    const newPassword = data.accessPassword.trim();
    // 开了密码访问却没填密码：保存直接失败，别假装已保存。提示交给点「完成」那一下。
    if (
      data.visibility === "password" &&
      !newPassword &&
      !data.hasAccessPassword
    ) {
      throw new Error("ACCESS_PASSWORD_REQUIRED");
    }
    await Promise.all([
      orpcClient.posts.admin.update({
        id: post.id,
        data: {
          title: data.title,
          summary: data.summary,
          slug: data.slug,
          contentJson: data.contentJson,
          publishedAt: data.publishedAt,
          pinnedAt: data.pinnedAt,
          coverMediaId: data.coverMediaId,
          categoryId: data.categoryId,
          visibility: data.visibility,
          // 关掉密码访问就不再谈隐私保护。
          privacyProtected:
            data.visibility === "password" && data.privacyProtected,
          // Going public drops the password; blank input keeps the stored one.
          ...(data.visibility === "public"
            ? { accessPassword: null }
            : newPassword
              ? { accessPassword: newPassword }
              : {}),
        },
      }),
      orpcClient.tags.admin.setPostTags({
        postId: post.id,
        tagIds: persistableTagIds(data.tagIds),
      }),
    ]);

    void queryClient.invalidateQueries({
      queryKey: orpc.posts.admin.get.key({ input: { id: postId } }),
    });
    void queryClient.invalidateQueries({ queryKey: orpc.posts.list.key() });
    void queryClient.invalidateQueries({
      queryKey: orpc.posts.admin.list.key(),
    });
    void queryClient.invalidateQueries({ queryKey: orpc.tags.admin.key() });
    void queryClient.invalidateQueries({ queryKey: orpc.categories.key() });
    void queryClient.invalidateQueries({
      queryKey: orpc.media.linkedKeys.key(),
    });
  };

  return (
    <PostEditor
      key={post.id}
      initialData={initialData}
      publicSlug={post.publicSlug}
      onSave={handleSave}
    />
  );
}
