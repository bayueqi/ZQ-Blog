import { beforeEach, describe, expect, it } from "vitest";
import {
  createAdminTestContext,
  createTestContext,
  seedUser,
  waitForBackgroundTasks,
} from "tests/test-utils";
import * as CategoryService from "@/features/categories/categories.service";
import * as TagService from "@/features/tags/tags.service";
import * as PostService from "@/features/posts/services/posts.service";
import { unwrap } from "@/lib/errors";

describe("Category", () => {
  let adminContext: ReturnType<typeof createAdminTestContext>;

  beforeEach(async () => {
    adminContext = createAdminTestContext();
    await seedUser(adminContext.db, adminContext.session.user);
  });

  it("lists a published Post by its current Category", async () => {
    const category = unwrap(
      await CategoryService.createCategory(adminContext, { name: "技术" }),
    );
    const { id } = await PostService.createEmptyPost(adminContext);
    unwrap(
      await PostService.updatePost(adminContext, {
        id,
        data: {
          title: "分类帖",
          slug: "category-post",
          categoryId: category.id,
        },
      }),
    );
    unwrap(await PostService.publishPost(adminContext, { id }));

    const publicContext = createTestContext();
    const listed = await PostService.getPostsCursor(publicContext, {
      categoryName: "技术",
    });
    expect(listed.items.map((post) => post.slug)).toEqual(["category-post"]);
    expect(listed.items[0]?.category).toEqual({
      id: category.id,
      name: "技术",
    });

    const uncategorized = await PostService.getPostsCursor(publicContext, {
      uncategorized: true,
    });
    expect(uncategorized.items.map((post) => post.slug)).not.toContain(
      "category-post",
    );
  });

  it("counts Posts without a Category for the Admin list", async () => {
    unwrap(
      await CategoryService.createCategory(adminContext, { name: "技术" }),
    );
    await PostService.createEmptyPost(adminContext);
    const listed = await CategoryService.getCategories(adminContext);
    expect(listed.items).toHaveLength(1);
    expect(listed.uncategorizedPostCount).toBeGreaterThanOrEqual(1);
  });

  it("makes Published Posts uncategorized after the Category is deleted", async () => {
    const category = unwrap(
      await CategoryService.createCategory(adminContext, { name: "生活" }),
    );
    const { id } = await PostService.createEmptyPost(adminContext);
    unwrap(
      await PostService.updatePost(adminContext, {
        id,
        data: {
          title: "生活帖",
          slug: "life-post",
          categoryId: category.id,
        },
      }),
    );
    unwrap(await PostService.publishPost(adminContext, { id }));
    unwrap(
      await CategoryService.deleteCategory(adminContext, { id: category.id }),
    );
    await waitForBackgroundTasks(adminContext.executionCtx);

    const publicContext = createTestContext();
    const byName = await PostService.getPostsCursor(publicContext, {
      categoryName: "生活",
    });
    expect(byName.items).toHaveLength(0);

    const post = await PostService.findPostBySlug(publicContext, {
      slug: "life-post",
    });
    expect(post?.category).toBeNull();
  });
  it("updates shared assignments and warm public caches while keeping edited content unpublished", async () => {
    const category = unwrap(
      await CategoryService.createCategory(adminContext, {
        name: "New category",
      }),
    );
    const tag = unwrap(
      await TagService.createTag(adminContext, { name: "New tag" }),
    );
    const { id } = await PostService.createEmptyPost(adminContext);
    unwrap(
      await PostService.updatePost(adminContext, {
        id,
        data: { title: "Public title", slug: "shared-assignments" },
      }),
    );
    unwrap(await PostService.publishPost(adminContext, { id }));
    const reader = createTestContext();
    await PostService.findPostBySlug(reader, { slug: "shared-assignments" });
    await CategoryService.getPublicCategories(reader);
    await TagService.getPublicTags(reader);
    await waitForBackgroundTasks(reader.executionCtx);

    unwrap(
      await PostService.updatePost(adminContext, {
        id,
        data: { title: "Unpublished title", categoryId: category.id },
      }),
    );
    await TagService.setPostTags(adminContext, {
      postId: id,
      tagIds: [tag.id],
    });
    await waitForBackgroundTasks(adminContext.executionCtx);

    const post = await PostService.findPostBySlug(createTestContext(), {
      slug: "shared-assignments",
    });
    expect(post?.title).toBe("Public title");
    expect(post?.category).toEqual({ id: category.id, name: category.name });
    expect(post?.tags?.map((item) => item.id)).toEqual([tag.id]);
    expect(
      await CategoryService.getPublicCategories(createTestContext()),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: category.id, postCount: 1 }),
      ]),
    );
    expect(await TagService.getPublicTags(createTestContext())).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: tag.id, postCount: 1 }),
      ]),
    );
  });
});
