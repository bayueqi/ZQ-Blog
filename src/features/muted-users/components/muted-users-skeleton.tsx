import { SkeletonListRows } from "@/components/ui/skeleton";

export function MutedUsersListSkeleton() {
  return (
    <SkeletonListRows
      count={4}
      avatar="circle"
      lines={["h-5 w-1/4", "h-3 w-1/3"]}
    />
  );
}
