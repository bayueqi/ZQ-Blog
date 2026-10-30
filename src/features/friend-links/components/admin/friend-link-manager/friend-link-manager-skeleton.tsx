import { Skeleton, SkeletonListRows } from "@/components/ui/skeleton";
import "@/components/ui/page-heading.css";
import "@/components/ui/tabs.css";
import "./friend-link-manager.css";
export function FriendLinkManagerSkeleton() {
  return (
    <SkeletonListRows
      count={5}
      avatar="square"
      lines={["h-5 w-1/3", "h-4 w-2/3", "h-3 w-1/2"]}
    />
  );
}

export function FriendLinkManagerPageSkeleton() {
  return (
    <div
      className="friend-workspace admin-workspace fuwari-card-base"
      aria-hidden="true"
    >
      <div className="fuwari-page-header friend-header">
        <Skeleton className="h-8 w-36" />
      </div>
      <div className="fuwari-tabs friend-tabs py-4">
        <Skeleton className="h-6 w-64" />
      </div>
      <div className="friend-body">
        <div className="friend-queue">
          <FriendLinkManagerSkeleton />
        </div>
        <div className="friend-detail p-8 gap-8">
          <Skeleton className="h-20 w-20 rounded-full" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
