import { Skeleton } from "@/components/ui/skeleton";
import "@/components/ui/page-heading.css";
import "@/components/ui/tabs.css";
import "./post-manager.css";

function PostRowSkeleton() {
  return (
    <tr aria-hidden="true">
      <td colSpan={4}>
        <div className="flex items-center gap-8 py-2">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3 rounded" />
            <Skeleton className="h-3 w-1/3 rounded" />
          </div>
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="hidden sm:block h-4 w-24 rounded" />
        </div>
      </td>
    </tr>
  );
}

export function PostManagerSkeleton() {
  return (
    <>
      {[1, 2, 3, 4, 5].map((id) => (
        <PostRowSkeleton key={id} />
      ))}
    </>
  );
}

export function PostManagerPageSkeleton() {
  return (
    <div
      className="post-manager admin-workspace fuwari-card-base"
      aria-busy="true"
    >
      <div className="fuwari-page-header post-list-heading">
        <Skeleton className="h-8 w-28 rounded" />
        <Skeleton className="h-10 w-24 rounded" />
      </div>
      <div className="fuwari-tabs post-list-tabs h-12 items-center">
        {[1, 2, 3].map((id) => (
          <Skeleton key={id} className="h-4 w-16 rounded" />
        ))}
      </div>
      <div className="post-list-controls">
        <Skeleton className="h-11 w-80" />
      </div>
      <table className="post-list-table">
        <tbody>
          <PostManagerSkeleton />
        </tbody>
      </table>
    </div>
  );
}
