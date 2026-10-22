import { Skeleton } from "@/components/ui/skeleton";
import "@/components/ui/page-heading.css";
import "./dashboard.css";

/** The hero is tinted, so its placeholders take the card's colour. */
const ON_HERO = "bg-(--fuwari-card-bg) opacity-70";

function SectionTitle({ width }: { width: string }) {
  return <Skeleton className={`h-5 ${width}`} />;
}

/** The dashboard's layout in placeholders: hero, figures, then sections. */
export function DashboardSkeleton() {
  return (
    <div
      className="dashboard-workspace admin-workspace fuwari-card-base"
      aria-hidden="true"
    >
      <div className="dashboard-hero">
        <div className="dashboard-hero-content w-full gap-3">
          <Skeleton className={`h-3.5 w-28 ${ON_HERO}`} />
          <Skeleton className={`h-9 w-72 max-w-full ${ON_HERO}`} />
          <Skeleton className={`h-4 w-96 max-w-full ${ON_HERO}`} />
          <Skeleton className={`mt-3 h-10 w-52 ${ON_HERO}`} />
        </div>
      </div>
      <ul className="dashboard-stats">
        {[0, 1, 2, 3].map((figure) => (
          <li key={figure}>
            <div className="dashboard-stat gap-2.5">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-24" />
            </div>
          </li>
        ))}
      </ul>
      <div className="dashboard-grid">
        <div className="dashboard-column dashboard-column-main">
          <div className="dashboard-section dashboard-slot-visitors">
            <SectionTitle width="w-28" />
            <Skeleton className="h-3.5 w-40" />
            <div className="mt-2 flex flex-wrap gap-6">
              <Skeleton className="h-40 w-40 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-24 w-full rounded-md" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          </div>
          <div className="dashboard-section dashboard-slot-activity">
            <SectionTitle width="w-24" />
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="mt-2 aspect-[4/1] w-full rounded-md" />
          </div>
        </div>
        <div className="dashboard-column dashboard-column-side">
          <div className="dashboard-section dashboard-slot-comments">
            <SectionTitle width="w-28" />
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="flex gap-3 py-3">
                <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
