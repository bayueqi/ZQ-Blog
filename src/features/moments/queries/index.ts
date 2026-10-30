import { orpc } from "@/lib/orpc";

export function momentsQuery() {
  return orpc.moments.list.queryOptions();
}

export function adminMomentsQuery() {
  return orpc.moments.admin.list.queryOptions();
}
