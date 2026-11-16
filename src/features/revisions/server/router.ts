import {
  ContentRevisionDetailSchema,
  ContentRevisionListSchema,
  DeleteContentRevisionsInputSchema,
  DeleteContentRevisionsResultSchema,
  FindContentRevisionInputSchema,
  ListContentRevisionsInputSchema,
  RestoreContentRevisionInputSchema,
} from "@/features/revisions/revisions.schema";
import * as Service from "@/features/revisions/service/revisions.service";
import { adminProcedure } from "@/lib/orpc/procedure";
import { unwrapResult } from "@/lib/orpc/unwrap-result";
const revisionErrors = {
  NOT_FOUND: { status: 404, message: "Content not found." },
  REVISION_NOT_FOUND: { status: 404, message: "Revision not found." },
} as const;

const list = adminProcedure
  .errors(revisionErrors)
  .route({
    method: "GET",
    path: "/admin/revisions",
    summary: "List revisions of a moment or a gallery collection",
    tags: ["Admin Revisions"],
  })
  .input(ListContentRevisionsInputSchema)
  .output(ContentRevisionListSchema)
  .handler(({ context, input }) =>
    Service.listContentRevisions(context, input),
  );

const get = adminProcedure
  .route({
    method: "GET",
    path: "/admin/revisions/{revisionId}",
    summary: "Get one revision of a moment or a gallery collection",
    tags: ["Admin Revisions"],
  })
  .input(FindContentRevisionInputSchema)
  .output(ContentRevisionDetailSchema.nullable())
  .handler(
    async ({ context, input }) =>
      (await Service.findContentRevision(context, input)) ?? null,
  );

const restore = adminProcedure
  .errors(revisionErrors)
  .route({
    method: "POST",
    path: "/admin/revisions/restore",
    summary: "Restore a moment or a gallery collection to an older revision",
    tags: ["Admin Revisions"],
  })
  .input(RestoreContentRevisionInputSchema)
  .handler(({ context, input, errors }) =>
    unwrapResult(Service.restoreContentRevision(context, input), {
      NOT_FOUND: () => {
        throw errors.NOT_FOUND();
      },
      REVISION_NOT_FOUND: () => {
        throw errors.REVISION_NOT_FOUND();
      },
    }),
  );

const remove = adminProcedure
  .route({
    method: "DELETE",
    path: "/admin/revisions",
    summary: "Delete revisions of a moment or a gallery collection",
    tags: ["Admin Revisions"],
  })
  .input(DeleteContentRevisionsInputSchema)
  .output(DeleteContentRevisionsResultSchema)
  .handler(({ context, input }) =>
    Service.deleteContentRevisionEntries(context, input),
  );

export default {
  admin: { list, get, restore, remove },
};
