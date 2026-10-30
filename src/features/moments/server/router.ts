import {
  AdminMomentListSchema,
  MomentCardSchema,
  MomentIdInputSchema,
  MomentListSchema,
  MomentPinInputSchema,
  MomentUpdateInputSchema,
  MomentWriteInputSchema,
} from "@/features/moments/moments.schema";
import * as MomentsService from "@/features/moments/service/moments.service";
import { adminProcedure, optionalSessionProcedure } from "@/lib/orpc/procedure";
import { unwrapResult } from "@/lib/orpc/unwrap-result";

const momentErrors = {
  NOT_FOUND: { status: 404, message: "Moment not found." },
  EMPTY: { status: 400, message: "A moment needs text or an image." },
  WRONG_PASSWORD: { status: 401, message: "Wrong password." },
  NOT_LOCKED: { status: 400, message: "This moment has no password." },
} as const;

const list = optionalSessionProcedure
  .errors(momentErrors)
  .route({
    method: "GET",
    path: "/moments",
    summary: "List published moments",
    description:
      "A password-protected moment comes back locked, with no text and no images.",
    tags: ["Moments"],
  })
  .output(MomentListSchema)
  .handler(({ context }) => MomentsService.listPublished(context));

const adminList = adminProcedure
  .errors(momentErrors)
  .route({
    method: "GET",
    path: "/admin/moments",
    summary: "List moments for admin",
    tags: ["Admin Moments"],
  })
  .output(AdminMomentListSchema)
  .handler(({ context }) => MomentsService.listForAdmin(context));

const create = adminProcedure
  .errors(momentErrors)
  .route({
    method: "POST",
    path: "/admin/moments",
    summary: "Write a moment",
    tags: ["Admin Moments"],
  })
  .input(MomentWriteInputSchema)
  .output(MomentCardSchema)
  .handler(({ context, input, errors }) =>
    unwrapResult(MomentsService.createMoment(context, input), {
      EMPTY: () => {
        throw errors.EMPTY();
      },
      NOT_FOUND: () => {
        throw errors.NOT_FOUND();
      },
    }),
  );

const update = adminProcedure
  .errors(momentErrors)
  .route({
    method: "PUT",
    path: "/admin/moments/{id}",
    summary: "Edit a moment",
    tags: ["Admin Moments"],
  })
  .input(MomentUpdateInputSchema)
  .output(MomentCardSchema)
  .handler(({ context, input, errors }) =>
    unwrapResult(MomentsService.updateMoment(context, input), {
      EMPTY: () => {
        throw errors.EMPTY();
      },
      NOT_FOUND: () => {
        throw errors.NOT_FOUND();
      },
    }),
  );

const pin = adminProcedure
  .errors(momentErrors)
  .route({
    method: "PUT",
    path: "/admin/moments/{id}/pin",
    summary: "Pin or unpin a moment",
    tags: ["Admin Moments"],
  })
  .input(MomentPinInputSchema)
  .handler(({ context, input, errors }) =>
    unwrapResult(MomentsService.setMomentPinned(context, input), {
      NOT_FOUND: () => {
        throw errors.NOT_FOUND();
      },
    }),
  );

const remove = adminProcedure
  .errors(momentErrors)
  .route({
    method: "DELETE",
    path: "/admin/moments/{id}",
    summary: "Delete a moment",
    tags: ["Admin Moments"],
  })
  .input(MomentIdInputSchema)
  .handler(({ context, input, errors }) =>
    unwrapResult(MomentsService.removeMoment(context, input), {
      NOT_FOUND: () => {
        throw errors.NOT_FOUND();
      },
    }),
  );

export default {
  list,
  admin: { list: adminList, create, update, remove, pin },
};
