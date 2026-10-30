import { LayoutGrid, List } from "lucide-react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Tabs } from "@/components/ui/tabs";
import type { MediaFilter } from "@/features/media/queries";
import { m } from "@/paraglide/messages";

export type MediaView = "grid" | "list";

export function MediaToolbar({
  filter,
  onFilterChange,
  unusedCount,
  usedCount,
  totalCount,
  view,
  onViewChange,
}: {
  filter: MediaFilter;
  onFilterChange: (value: MediaFilter) => void;
  unusedCount?: number;
  usedCount?: number;
  totalCount?: number;
  view: MediaView;
  onViewChange: (view: MediaView) => void;
}) {
  return (
    <div className="media-workspace-toolbar">
      <Tabs
        className="media-workspace-tabs"
        aria-label={m.media_filter_label()}
        value={filter}
        onValueChange={(value) => onFilterChange(value as MediaFilter)}
        items={[
          {
            value: "all",
            label: m.media_filter_all(),
            count: totalCount ?? "—",
          },
          {
            value: "used",
            label: m.media_filter_used(),
            count: usedCount ?? "—",
          },
          {
            value: "unused",
            label: m.media_unreferenced(),
            count: unusedCount ?? "—",
          },
        ]}
      />
      <SegmentedControl
        className="media-view-switch"
        aria-label={m.media_view_label()}
        value={view}
        onValueChange={onViewChange}
        items={(
          [
            ["grid", LayoutGrid, m.media_view_grid()],
            ["list", List, m.media_view_list()],
          ] as const
        ).map(([value, Icon, label]) => ({
          value,
          label: (
            <>
              <Icon size={16} aria-hidden="true" />
              {label}
            </>
          ),
        }))}
      />
    </div>
  );
}
