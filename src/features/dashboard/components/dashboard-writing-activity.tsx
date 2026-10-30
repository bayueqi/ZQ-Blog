import { type PointerEvent, useMemo, useRef, useState } from "react";
import { SectionHeading } from "@/components/ui/page-heading";
import type { DashboardOverview } from "@/features/dashboard/dashboard.schema";
import {
  buildWritingCalendar,
  type WritingDay,
  type WritingLevel,
} from "@/features/dashboard/writing-calendar";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { formatDay, formatMonth, formatWeekdayNarrow } from "./format";
import "./writing-heatmap.css";

const LEVELS: Array<WritingLevel> = [0, 1, 2, 3, 4];
/** Monday, Wednesday and Friday label rows 1, 3 and 5. */
const LABELLED_ROWS = [0, 2, 4];

function dayLabel(day: WritingDay) {
  const date = formatDay(day.date);
  return day.count > 0
    ? m.dashboard_writing_day({ date, count: day.count })
    : m.dashboard_writing_day_none({ date });
}

function weekdayNames(firstWeek: Array<WritingDay>) {
  return firstWeek.map((day) => formatWeekdayNarrow(day.date));
}

/**
 * A calendar of the last half year: one cell per local day, darker the more
 * the Admin wrote that day. Every cell is labelled with its date and count.
 */
export function DashboardWritingActivity({
  activity,
  className,
}: {
  activity: DashboardOverview["writingActivity"];
  className?: string;
}) {
  const calendar = useMemo(
    () => buildWritingCalendar(activity, new Date()),
    [activity],
  );
  /* 每格只算一次文案；悬停换格时沿用同一批节点，不重排整张图。 */
  const grid = useMemo(
    () =>
      calendar.weeks.flat().map((day) => {
        if (day.future) {
          return (
            <span
              key={day.date.getTime()}
              className="writing-heatmap-cell"
              data-future=""
              aria-hidden="true"
            />
          );
        }
        const label = dayLabel(day);
        return (
          <span
            key={day.date.getTime()}
            role="img"
            aria-label={label}
            data-label={label}
            data-level={day.level}
            className="writing-heatmap-cell"
          />
        );
      }),
    [calendar],
  );
  const frameRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  const summary =
    calendar.activeDays > 0
      ? [
          m.dashboard_writing_days({ count: calendar.activeDays }),
          m.dashboard_writing_streak({ count: calendar.longestStreak }),
        ].join(" · ")
      : m.dashboard_writing_none();
  const weekdays = weekdayNames(calendar.weeks[0] ?? []);
  const months = calendar.months.filter(
    (month, index, all) =>
      index === 0 || month.week - (all[index - 1]?.week ?? 0) >= 3,
  );
  if (months[0] && months[0].week >= 3) {
    const first = calendar.weeks[0]?.[0];
    if (first) months.unshift({ week: 0, date: first.date });
  }

  const showTip = (event: PointerEvent<HTMLDivElement>) => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-label]",
    );
    const frame = frameRef.current;
    if (!cell || !frame) return setTip(null);
    const cellBox = cell.getBoundingClientRect();
    const frameBox = frame.getBoundingClientRect();
    setTip({
      text: cell.dataset.label ?? "",
      x: cellBox.left + cellBox.width / 2 - frameBox.left,
      y: cellBox.top - frameBox.top,
    });
  };

  return (
    <section className={cn("dashboard-section dashboard-activity", className)}>
      <SectionHeading
        size="md"
        title={m.dashboard_writing_title()}
        description={summary}
      />
      <div
        ref={frameRef}
        className="writing-heatmap"
        style={{ "--writing-weeks": calendar.weeks.length } as object}
      >
        <div className="writing-heatmap-months" aria-hidden="true">
          {months.map((month) => (
            <span key={month.week} style={{ gridColumnStart: month.week + 1 }}>
              {formatMonth(month.date)}
            </span>
          ))}
        </div>
        <div className="writing-heatmap-weekdays" aria-hidden="true">
          {weekdays.map((name, row) => (
            <span key={row}>{LABELLED_ROWS.includes(row) ? name : ""}</span>
          ))}
        </div>
        <div
          role="group"
          aria-label={summary}
          className="writing-heatmap-grid"
          onPointerOver={showTip}
          onPointerLeave={() => setTip(null)}
        >
          {grid}
        </div>
        {tip ? (
          <div
            className="writing-heatmap-tip"
            aria-hidden="true"
            style={{ left: tip.x, top: tip.y }}
          >
            {tip.text}
          </div>
        ) : null}
      </div>
      <div className="writing-heatmap-foot">
        <p>{m.dashboard_writing_basis()}</p>
        <div className="writing-heatmap-legend" aria-hidden="true">
          <span>{m.dashboard_writing_less()}</span>
          {LEVELS.map((level) => (
            <span
              key={level}
              className="writing-heatmap-cell"
              data-level={level}
            />
          ))}
          <span>{m.dashboard_writing_more()}</span>
        </div>
      </div>
    </section>
  );
}
