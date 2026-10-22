import { useMemo, useState } from "react";
import { SectionHeading } from "@/components/ui/page-heading";
import type { DashboardOverview } from "@/features/dashboard/dashboard.schema";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { formatCount } from "./format";
import "./visitors.css";

type Visitors = DashboardOverview["visitors"];
type DimensionKey = Visitors["dimensions"][number]["key"];
type DimensionItem = Visitors["dimensions"][number]["items"][number];

const TABS: Array<{ key: DimensionKey; label: () => string }> = [
  { key: "browser", label: () => m.dashboard_visitors_tab_browser() },
  { key: "device", label: () => m.dashboard_visitors_tab_device() },
  { key: "os", label: () => m.dashboard_visitors_tab_os() },
  { key: "country", label: () => m.dashboard_visitors_tab_country() },
];

const COLORS = [
  "var(--visitor-1)",
  "var(--visitor-2)",
  "var(--visitor-3)",
  "var(--visitor-4)",
  "var(--visitor-5)",
];

const DONUT_RADIUS = 52;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

/** 趋势线的绘图区，和 viewBox 同一个坐标系。 */
const PLOT = { left: 6, right: 314, top: 12, bottom: 104 };

function localeTag() {
  return getLocale() === "zh" ? "zh-CN" : "en-US";
}

/** 格式化器建一次就够，别在每次渲染、每个条目上重造。 */
function createFormatters(tag: string) {
  return {
    region: new Intl.DisplayNames([tag], { type: "region" }),
    day: new Intl.DateTimeFormat(tag, {
      month: "numeric",
      day: "numeric",
      timeZone: "UTC",
    }),
  };
}

type Formatters = ReturnType<typeof createFormatters>;

/** 设备给的是键，其余给的是名字或国家代码。 */
function labelOf(key: DimensionKey, label: string, formats: Formatters) {
  if (key === "device") {
    switch (label) {
      case "desktop":
        return m.dashboard_visitors_device_desktop();
      case "mobile":
        return m.dashboard_visitors_device_mobile();
      case "tablet":
        return m.dashboard_visitors_device_tablet();
      default:
        return m.dashboard_visitors_other();
    }
  }
  if (label === "Other" || label === "ZZ") return m.dashboard_visitors_other();
  if (key === "country") {
    try {
      return formats.region.of(label) ?? label;
    } catch {
      return label;
    }
  }
  return label;
}

function share(views: number, total: number) {
  return total > 0 ? Math.round((views / total) * 100) : 0;
}

/**
 * 访客构成：一块环形图看占比，一条折线看最近几天，
 * 底下是当前维度的完整排行。
 */
export function DashboardVisitors({
  visitors,
  className,
}: {
  visitors: Visitors;
  className?: string;
}) {
  const [active, setActive] = useState<DimensionKey>("browser");

  const tag = localeTag();
  const formats = useMemo(() => createFormatters(tag), [tag]);
  const dimension =
    visitors.dimensions.find((item) => item.key === active) ??
    visitors.dimensions[0];
  const items: Array<DimensionItem> = dimension?.items ?? [];

  const listed = items.reduce((sum, item) => sum + item.views, 0);
  const rest = Math.max(0, visitors.total - listed);
  const slices = [
    ...items.map((item, index) => ({
      id: item.label,
      label: labelOf(active, item.label, formats),
      views: item.views,
      color: COLORS[index % COLORS.length] ?? COLORS[0],
    })),
    ...(rest > 0
      ? [
          {
            id: "rest",
            label: m.dashboard_visitors_other(),
            views: rest,
            color: "var(--visitor-rest)",
          },
        ]
      : []),
  ];

  // 环形图的每一段：长度和起始位置都得先算好。
  let dashOffset = 0;
  const arcs = slices.map((slice) => {
    const length =
      (slice.views / Math.max(1, visitors.total)) * DONUT_CIRCUMFERENCE;
    const arc = { ...slice, length, offset: dashOffset };
    dashOffset += length;
    return arc;
  });

  const top = slices[0];
  const trend = items.slice(0, 2);
  const trendMax = Math.max(1, ...trend.flatMap((item) => item.daily));

  const x = (index: number) =>
    PLOT.left +
    (index * (PLOT.right - PLOT.left)) / Math.max(1, visitors.days.length - 1);
  const y = (views: number) =>
    PLOT.bottom - (views / trendMax) * (PLOT.bottom - PLOT.top);
  const lastDay = visitors.days.length - 1;

  return (
    <section className={cn("dashboard-section dashboard-visitors", className)}>
      <SectionHeading
        size="md"
        title={m.dashboard_visitors_title()}
        description={m.dashboard_visitors_window({
          days: visitors.days.length,
          count: formatCount(visitors.total),
        })}
      />
      <div
        className="visitor-tabs"
        role="tablist"
        aria-label={m.dashboard_visitors_title()}
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={tab.key === active}
            className="visitor-tab"
            onClick={() => setActive(tab.key)}
          >
            {tab.label()}
          </button>
        ))}
      </div>

      {visitors.total === 0 ? (
        <p className="visitor-empty">{m.dashboard_visitors_empty()}</p>
      ) : (
        <div className="visitor-body" role="tabpanel">
          <div className="visitor-donut">
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle
                className="visitor-donut-track"
                cx="60"
                cy="60"
                r={DONUT_RADIUS}
                fill="none"
                strokeWidth="14"
              />
              {arcs.map((arc) => (
                <circle
                  key={arc.id}
                  cx="60"
                  cy="60"
                  r={DONUT_RADIUS}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth="14"
                  strokeDasharray={`${arc.length} ${DONUT_CIRCUMFERENCE - arc.length}`}
                  strokeDashoffset={-arc.offset}
                  transform="rotate(-90 60 60)"
                />
              ))}
            </svg>
            {top ? (
              <div className="visitor-donut-center">
                <span className="visitor-donut-label">{top.label}</span>
                <span className="visitor-donut-value">
                  {formatCount(top.views)}
                </span>
                <span className="visitor-donut-share">
                  {share(top.views, visitors.total)}%
                </span>
              </div>
            ) : null}
          </div>

          <div className="visitor-trend-block">
            <p className="visitor-trend-title">
              {m.dashboard_visitors_trend()}
            </p>
            <svg
              className="visitor-trend"
              viewBox="0 0 320 132"
              role="img"
              aria-label={m.dashboard_visitors_trend()}
            >
              {[0, 0.5, 1].map((step) => (
                <line
                  key={step}
                  className="visitor-trend-grid"
                  x1={PLOT.left}
                  x2={PLOT.right}
                  y1={PLOT.bottom - step * (PLOT.bottom - PLOT.top)}
                  y2={PLOT.bottom - step * (PLOT.bottom - PLOT.top)}
                />
              ))}
              <text
                className="visitor-trend-caption"
                x={PLOT.right}
                y={PLOT.top - 2}
                textAnchor="end"
              >
                {formatCount(trendMax)}
              </text>
              {trend.map((item, index) => (
                <g key={item.label}>
                  <polyline
                    fill="none"
                    stroke={COLORS[index % COLORS.length]}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={item.daily
                      .map((views, day) => `${x(day)},${y(views)}`)
                      .join(" ")}
                  />
                  {item.daily.map((views, day) => (
                    <circle
                      key={day}
                      cx={x(day)}
                      cy={y(views)}
                      r="2.5"
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </g>
              ))}
              {visitors.days.map((day, index) =>
                index === 0 ||
                index === lastDay ||
                index === Math.floor(lastDay / 2) ? (
                  <text
                    key={day}
                    className="visitor-trend-caption"
                    x={x(index)}
                    y="124"
                    textAnchor={
                      index === 0
                        ? "start"
                        : index === lastDay
                          ? "end"
                          : "middle"
                    }
                  >
                    {formats.day.format(new Date(`${day}T00:00:00Z`))}
                  </text>
                ) : null,
              )}
            </svg>
          </div>

          <ul className="visitor-legend">
            {slices.map((slice) => (
              <li key={slice.id}>
                <span
                  className="visitor-swatch"
                  style={{ background: slice.color }}
                />
                <span className="visitor-legend-label">{slice.label}</span>
                <span className="visitor-legend-share">
                  {share(slice.views, visitors.total)}%
                </span>
                <span className="visitor-legend-count">
                  {m.dashboard_visitors_count({
                    count: formatCount(slice.views),
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
