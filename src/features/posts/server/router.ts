import { z } from "zod";
import {
  AdminPostListPageSchema,
  CreatePostInputSchema,
  HomePostsInputSchema,
  HomePostsResponseSchema,
  DeletePostInputSchema,
  FindPostByIdInputSchema,
  AdjacentPostsSchema,
  FindPostBySlugInputSchema,
  GenerateSlugInputSchema,
  GenerateSummaryInputSchema,
  GenerateSummaryOutputSchema,
  GetPostsCursorInputSchema,
  GetPostsInputSchema,
  AdminPostSchema,
  PostItemSchema,
  PostListResponseSchema,
  PostWithTocSchema,
  PublishPostInputSchema,
  UnpublishPostInputSchema,
  UpdatePostInputSchema,
  VideoMetaInputSchema,
  VideoMetaSchema,
} from "@/features/posts/schema/posts.schema";
import {
  DeletePostRevisionsInputSchema,
  FindPostRevisionByIdInputSchema,
  ListPostRevisionsInputSchema,
  PostRevisionListItemSchema,
  PostRevisionSelectSchema,
  RestorePostRevisionInputSchema,
} from "@/features/posts/schema/post-revisions.schema";
import * as PostRevisionService from "@/features/posts/services/post-revisions.service";
import * as PostService from "@/features/posts/services/posts.service";
import * as VideoMetaService from "@/features/posts/services/video-meta.service";
import { videoSourceOf } from "@/features/posts/utils/video-source";
import { getPostPublisher } from "@/lib/do/post-publisher-binding";
import {
  adminProcedure,
  optionalSessionProcedure,
  publicProcedure,
} from "@/lib/orpc/procedure";
import { unwrapResult } from "@/lib/orpc/unwrap-result";

const postErrors = {
  POST_NOT_FOUND: { status: 404, message: "Post not found." },
  POST_REVISION_NOT_FOUND: { status: 404, message: "Post revision not found." },
  POST_REVISION_INVALID_SNAPSHOT: {
    status: 400,
    message: "Post revision snapshot is invalid.",
  },
  PUBLISHED_AT_IN_FUTURE: {
    status: 400,
    message: "Publish date cannot be in the future.",
  },
  PUBLIC_SLUG_TAKEN: {
    status: 409,
    message: "This public slug is already in use.",
  },
  MEDIA_NOT_FOUND: { status: 404, message: "Media not found." },
  CATEGORY_NOT_FOUND: { status: 404, message: "Category not found." },
  ACCESS_PASSWORD_REQUIRED: {
    status: 400,
    message: "A password-protected post needs a password.",
  },
} as const;

const list = publicProcedure
  .route({
    method: "GET",
    path: "/posts",
    summary: "List published posts",
    tags: ["Posts"],
  })
  .input(GetPostsCursorInputSchema)
  .output(PostListResponseSchema)
  .handler(({ context, input }) => PostService.getPostsCursor(context, input));

const home = publicProcedure
  .route({
    method: "GET",
    path: "/posts/home/page",
    summary: "List homepage posts, pinned first",
    tags: ["Posts"],
  })
  .input(HomePostsInputSchema)
  .output(HomePostsResponseSchema)
  .handler(({ context, input }) =>
    PostService.getHomePosts(context, input.page),
  );

const bySlug = optionalSessionProcedure
  .route({
    method: "GET",
    path: "/posts/{slug}",
    summary: "Get a published post by slug",
    description:
      "Password-protected posts come back with locked=true and no body until the unlock cookie is present.",
    tags: ["Posts"],
  })
  .input(FindPostBySlugInputSchema)
  .output(PostWithTocSchema)
  .handler(({ context, input }) => PostService.findPostBySlug(context, input));

const adjacent = publicProcedure
  .route({
    method: "GET",
    path: "/posts/{slug}/adjacent",
    summary: "Get the adjacent published posts by publication date",
    tags: ["Posts"],
  })
  .input(FindPostBySlugInputSchema)
  .output(AdjacentPostsSchema)
  .handler(({ context, input }) =>
    PostService.getAdjacentPosts(context, input),
  );

const pinned = publicProcedure
  .route({
    method: "GET",
    path: "/posts/pinned",
    summary: "List pinned published posts",
    tags: ["Posts"],
  })
  .output(z.array(PostItemSchema))
  .handler(({ context }) => PostService.getPinnedPosts(context));

const adminList = adminProcedure
  .route({
    method: "GET",
    path: "/admin/posts",
    summary: "List posts for admin",
    tags: ["Admin Posts"],
  })
  .input(GetPostsInputSchema)
  .output(AdminPostListPageSchema)
  .handler(({ context, input }) =>
    PostService.listAdminPostsPage(context, input),
  );

const adminGet = adminProcedure
  .errors(postErrors)
  .route({
    method: "GET",
    path: "/admin/posts/{id}",
    summary: "Get a post by id",
    description:
      "Returns the editable Post. publicSnapshotContentJson is the Public Content Snapshot body, used to preview published code highlighting in the editor. It is not the draft.",
    tags: ["Admin Posts"],
  })
  .input(FindPostByIdInputSchema)
  .output(AdminPostSchema)
  .handler(({ context, input }) => PostService.findPostById(context, input));

const generateSlug = adminProcedure
  .route({
    method: "GET",
    path: "/admin/posts/slug",
    summary: "Generate a post slug",
    tags: ["Admin Posts"],
  })
  .input(GenerateSlugInputSchema)
  .handler(({ context, input }) => PostService.generateSlug(context, input));

const generateSummary = adminProcedure
  .route({
    method: "POST",
    path: "/admin/posts/summary",
    summary: "Generate a post summary with Workers AI",
    description:
      "Converts the draft body to plain text and asks the Workers AI binding for a short summary in the body's main language.",
    tags: ["Admin Posts"],
  })
  .input(GenerateSummaryInputSchema)
  .output(GenerateSummaryOutputSchema)
  .handler(({ context, input }) => PostService.generateSummary(context, input));

const videoMeta = adminProcedure
  .route({
    method: "GET",
    path: "/admin/posts/video-meta",
    summary: "Look up an embedded video's title, cover and length",
    description:
      "Asks the video's provider once, when the editor embeds it. Returns null when the provider has nothing to give or cannot be reached.",
    tags: ["Admin Posts"],
  })
  .input(VideoMetaInputSchema)
  .output(VideoMetaSchema)
  .handler(({ input }) => {
    const source = videoSourceOf(input);
    return source ? VideoMetaService.fetchVideoMeta(source) : null;
  });

const create = adminProcedure
  .route({
    method: "POST",
    path: "/admin/posts",
    summary: "Create a draft post",
    description:
      "With data, creates a new draft post carrying that content. Without data, returns an existing empty draft post when one exists, otherwise creates one.",
    tags: ["Admin Posts"],
  })
  .input(CreatePostInputSchema)
  .handler(({ context, input }) =>
    input?.data
      ? PostService.createDraft(context, input.data)
      : PostService.createEmptyPost(context),
  );

const update = adminProcedure
  .errors(postErrors)
  .route({
    method: "PATCH",
    path: "/admin/posts/{id}",
    summary: "Update a post",
    tags: ["Admin Posts"],
  })
  .input(UpdatePostInputSchema)
  .handler(({ context, input, errors }) =>
    unwrapResult(PostService.updatePost(context, input), {
      POST_NOT_FOUND: () => {
        throw errors.POST_NOT_FOUND();
      },
      MEDIA_NOT_FOUND: () => {
        throw errors.MEDIA_NOT_FOUND();
      },
      CATEGORY_NOT_FOUND: () => {
        throw errors.CATEGORY_NOT_FOUND();
      },
      ACCESS_PASSWORD_REQUIRED: () => {
        throw errors.ACCESS_PASSWORD_REQUIRED();
      },
    }),
  );

const remove = adminProcedure
  .errors(postErrors)
  .route({
    method: "DELETE",
    path: "/admin/posts/{id}",
    summary: "Delete a post",
    tags: ["Admin Posts"],
  })
  .input(DeletePostInputSchema)
  .handler(({ context, input, errors }) =>
    unwrapResult(PostService.deletePost(context, input), {
      POST_NOT_FOUND: () => {
        throw errors.POST_NOT_FOUND();
      },
    }),
  );

const publishPost = adminProcedure
  .errors(postErrors)
  .route({
    method: "POST",
    path: "/admin/posts/{id}/publish",
    summary: "Publish a post",
    description:
      "Publishes the post and generates or updates its Public Content Snapshot. Code blocks are highlighted on the server and stored in the snapshot.",
    tags: ["Admin Posts"],
  })
  .input(PublishPostInputSchema)
  .handler(async ({ input, errors }) => {
    const result = await (await getPostPublisher(input.id)).publish(input.id);
    return unwrapResult<{ success: boolean }>(result, {
      POST_NOT_FOUND: () => {
        throw errors.POST_NOT_FOUND();
      },
      PUBLISHED_AT_IN_FUTURE: () => {
        throw errors.PUBLISHED_AT_IN_FUTURE();
      },
      PUBLIC_SLUG_TAKEN: () => {
        throw errors.PUBLIC_SLUG_TAKEN();
      },
    });
  });

const unpublishPost = adminProcedure
  .errors(postErrors)
  .route({
    method: "POST",
    path: "/admin/posts/{id}/unpublish",
    summary: "Unpublish a post",
    tags: ["Admin Posts"],
  })
  .input(UnpublishPostInputSchema)
  .handler(async ({ input, errors }) => {
    const result = await (await getPostPublisher(input.id)).unpublish(input.id);
    return unwrapResult<{ success: boolean }>(result, {
      POST_NOT_FOUND: () => {
        throw errors.POST_NOT_FOUND();
      },
    });
  });

const listRevisions = adminProcedure
  .route({
    method: "GET",
    path: "/admin/posts/{postId}/revisions",
    summary: "List post revisions",
    tags: ["Admin Posts"],
  })
  .input(ListPostRevisionsInputSchema)
  .output(z.array(PostRevisionListItemSchema))
  .handler(({ context, input }) =>
    PostRevisionService.listPostRevisions(context, input),
  );

const getRevision = adminProcedure
  .route({
    method: "GET",
    path: "/admin/posts/{postId}/revisions/{revisionId}",
    summary: "Get a post revision",
    tags: ["Admin Posts"],
  })
  .input(FindPostRevisionByIdInputSchema)
  .output(PostRevisionSelectSchema.nullable())
  .handler(
    async ({ context, input }) =>
      (await PostRevisionService.findPostRevisionById(context, input)) ?? null,
  );

const restoreRevision = adminProcedure
  .errors(postErrors)
  .route({
    method: "POST",
    path: "/admin/posts/{postId}/revisions/{revisionId}/restore",
    summary: "Restore a post revision",
    tags: ["Admin Posts"],
  })
  .input(RestorePostRevisionInputSchema)
  .handler(({ context, input, errors }) =>
    unwrapResult(PostRevisionService.restorePostRevision(context, input), {
      POST_NOT_FOUND: () => {
        throw errors.POST_NOT_FOUND();
      },
      POST_REVISION_NOT_FOUND: () => {
        throw errors.POST_REVISION_NOT_FOUND();
      },
      POST_REVISION_INVALID_SNAPSHOT: () => {
        throw errors.POST_REVISION_INVALID_SNAPSHOT();
      },
    }),
  );

const deleteRevisions = adminProcedure
  .errors(postErrors)
  .route({
    method: "DELETE",
    path: "/admin/posts/{postId}/revisions",
    summary: "Delete post revisions",
    tags: ["Admin Posts"],
  })
  .input(DeletePostRevisionsInputSchema)
  .handler(({ context, input, errors }) =>
    unwrapResult(PostRevisionService.deletePostRevisions(context, input), {
      POST_NOT_FOUND: () => {
        throw errors.POST_NOT_FOUND();
      },
    }),
  );

export default {
  list,
  home,
  bySlug,
  adjacent,
  pinned,
  admin: {
    list: adminList,
    get: adminGet,
    generateSlug,
    generateSummary,
    videoMeta,
    create,
    update,
    remove,
    publish: publishPost,
    unpublish: unpublishPost,
    revisions: {
      list: listRevisions,
      get: getRevision,
      restore: restoreRevision,
      remove: deleteRevisions,
    },
  },
};
