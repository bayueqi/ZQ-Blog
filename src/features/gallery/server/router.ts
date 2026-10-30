import {
  AddGalleryPhotoInputSchema,
  CreateGalleryCategoryInputSchema,
  GalleryCategoryDetailSchema,
  GalleryCategoryInputSchema,
  GalleryCategoryListResponseSchema,
  GalleryIdInputSchema,
  GalleryPinInputSchema,
  UnlockGalleryCategoryInputSchema,
  UpdateGalleryCategoryInputSchema,
  UpdateGalleryPhotoInputSchema,
} from "@/features/gallery/gallery.schema";
import * as GalleryService from "@/features/gallery/service/gallery.service";
import {
  adminProcedure,
  optionalSessionProcedure,
  publicProcedure,
} from "@/lib/orpc/procedure";
import { unwrapResult } from "@/lib/orpc/unwrap-result";

const galleryErrors = {
  NOT_FOUND: { status: 404, message: "Gallery item not found." },
  WRONG_PASSWORD: { status: 401, message: "Wrong password." },
  NOT_LOCKED: { status: 400, message: "This gallery has no password." },
} as const;

const listCategories = publicProcedure
  .errors(galleryErrors)
  .route({
    method: "GET",
    path: "/gallery/categories",
    summary: "List gallery collections",
    tags: ["Gallery"],
  })
  .output(GalleryCategoryListResponseSchema)
  .handler(({ context }) => GalleryService.listCategories(context));

const categoryBySlug = optionalSessionProcedure
  .errors(galleryErrors)
  .route({
    method: "GET",
    path: "/gallery/categories/{slug}",
    summary: "Get a gallery collection with its photos",
    description:
      "A password-protected collection returns locked=true and no photos until the unlock cookie is present.",
    tags: ["Gallery"],
  })
  .input(GalleryCategoryInputSchema)
  .output(GalleryCategoryDetailSchema)
  .handler(async ({ context, input, errors }) => {
    const result = await GalleryService.getCategory(context, input);
    if (!result) throw errors.NOT_FOUND();
    return result;
  });

const unlock = publicProcedure
  .errors(galleryErrors)
  .route({
    method: "POST",
    path: "/gallery/unlock",
    summary: "Check a collection password",
    tags: ["Gallery"],
  })
  .input(UnlockGalleryCategoryInputSchema)
  .handler(({ context, input, errors }) =>
    unwrapResult(GalleryService.unlockCategory(context, input), {
      WRONG_PASSWORD: () => {
        throw errors.WRONG_PASSWORD();
      },
      NOT_LOCKED: () => {
        throw errors.NOT_LOCKED();
      },
    }),
  );

const adminListCategories = adminProcedure
  .route({
    method: "GET",
    path: "/admin/gallery/categories",
    summary: "List gallery collections for admin",
    tags: ["Admin Gallery"],
  })
  .handler(({ context }) => GalleryService.listCategoriesAdmin(context));

const adminCreateCategory = adminProcedure
  .errors(galleryErrors)
  .route({
    method: "POST",
    path: "/admin/gallery/categories",
    summary: "Create a gallery collection",
    tags: ["Admin Gallery"],
  })
  .input(CreateGalleryCategoryInputSchema)
  .handler(({ context, input }) =>
    unwrapResult(GalleryService.createCategory(context, input), {}),
  );

const adminUpdateCategory = adminProcedure
  .errors(galleryErrors)
  .route({
    method: "PATCH",
    path: "/admin/gallery/categories/{id}",
    summary: "Update a gallery collection",
    tags: ["Admin Gallery"],
  })
  .input(UpdateGalleryCategoryInputSchema)
  .handler(({ context, input, errors }) =>
    unwrapResult(GalleryService.updateCategory(context, input), {
      NOT_FOUND: () => {
        throw errors.NOT_FOUND();
      },
    }),
  );

const adminPinCategory = adminProcedure
  .errors(galleryErrors)
  .route({
    method: "PATCH",
    path: "/admin/gallery/categories/{id}/pin",
    summary: "Pin or unpin a gallery collection",
    tags: ["Admin Gallery"],
  })
  .input(GalleryPinInputSchema)
  .handler(({ context, input, errors }) =>
    unwrapResult(GalleryService.setCategoryPinned(context, input), {
      NOT_FOUND: () => {
        throw errors.NOT_FOUND();
      },
    }),
  );

const adminDeleteCategory = adminProcedure
  .route({
    method: "DELETE",
    path: "/admin/gallery/categories/{id}",
    summary: "Delete a gallery collection",
    tags: ["Admin Gallery"],
  })
  .input(GalleryIdInputSchema)
  .handler(({ context, input }) =>
    GalleryService.deleteCategory(context, input.id),
  );

const adminListPhotos = adminProcedure
  .route({
    method: "GET",
    path: "/admin/gallery/photos",
    summary: "List photos of a collection",
    tags: ["Admin Gallery"],
  })
  .input(GalleryIdInputSchema)
  .handler(({ context, input }) =>
    GalleryService.listPhotosAdmin(context, input.id),
  );

const adminAddPhoto = adminProcedure
  .route({
    method: "POST",
    path: "/admin/gallery/photos",
    summary: "Add a photo to a collection",
    tags: ["Admin Gallery"],
  })
  .input(AddGalleryPhotoInputSchema)
  .handler(({ context, input }) => GalleryService.addPhoto(context, input));

const adminUpdatePhoto = adminProcedure
  .errors(galleryErrors)
  .route({
    method: "PATCH",
    path: "/admin/gallery/photos/{id}",
    summary: "Update a photo caption or order",
    tags: ["Admin Gallery"],
  })
  .input(UpdateGalleryPhotoInputSchema)
  .handler(({ context, input, errors }) =>
    unwrapResult(GalleryService.updatePhoto(context, input), {
      NOT_FOUND: () => {
        throw errors.NOT_FOUND();
      },
    }),
  );

const adminDeletePhoto = adminProcedure
  .route({
    method: "DELETE",
    path: "/admin/gallery/photos/{id}",
    summary: "Remove a photo from a collection",
    tags: ["Admin Gallery"],
  })
  .input(GalleryIdInputSchema)
  .handler(({ context, input }) =>
    GalleryService.deletePhoto(context, input.id),
  );

const galleryRouter = {
  categories: {
    list: listCategories,
    bySlug: categoryBySlug,
  },
  unlock,
  admin: {
    categories: {
      list: adminListCategories,
      create: adminCreateCategory,
      update: adminUpdateCategory,
      remove: adminDeleteCategory,
      pin: adminPinCategory,
    },
    photos: {
      list: adminListPhotos,
      add: adminAddPhoto,
      update: adminUpdatePhoto,
      remove: adminDeletePhoto,
    },
  },
};

export default galleryRouter;
