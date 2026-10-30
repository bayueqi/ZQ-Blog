import { Skeleton } from "@/components/ui/skeleton";
export function SettingsInnerSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-56 rounded-2xl" />
      <Skeleton className="h-32 rounded-2xl" />
    </div>
  );
}
