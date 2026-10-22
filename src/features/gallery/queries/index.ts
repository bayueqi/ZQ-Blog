import { orpc } from "@/lib/orpc";

export function galleryCategoriesQuery() {
  return orpc.gallery.categories.list.queryOptions();
}

export function galleryCategoryQuery(slug: string) {
  return orpc.gallery.categories.bySlug.queryOptions({ input: { slug } });
}

export function adminGalleryCategoriesQuery() {
  return orpc.gallery.admin.categories.list.queryOptions();
}

export function adminGalleryPhotosQuery(categoryId: number) {
  return orpc.gallery.admin.photos.list.queryOptions({
    input: { id: categoryId },
  });
}
