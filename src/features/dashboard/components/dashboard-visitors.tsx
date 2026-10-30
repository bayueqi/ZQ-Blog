import { ChevronDown, X } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { FuwariModal } from "@/components/ui/fuwari-modal";
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
  "var(--visitor-6)",
  "var(--visitor-7)",
  "var(--visitor-8)",
];

const DONUT_RADIUS = 52;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

/** The legend keeps room for three rows so the card height never moves. */
const LEGEND_ROWS = 3;

/**
 * 趋势线的坐标系。卡片里小一号，放大弹层里换一套更宽更高的，
 * 这样线和日期是缩放变大，而不是把小图拉糊。
 */
type TrendGeom = {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  labelY: number;
  stroke: number;
  point: number;
};

const CARD_TREND: TrendGeom = {
  width: 320,
  height: 132,
  left: 6,
  right: 314,
  top: 12,
  bottom: 104,
  labelY: 124,
  stroke: 2,
  point: 2.5,
};

const ZOOM_TREND: TrendGeom = {
  width: 720,
  height: 300,
  left: 10,
  right: 710,
  top: 18,
  bottom: 258,
  labelY: 286,
  stroke: 2.4,
  point: 3.4,
};

/** 窄屏弹层只有一块手机宽，用这张窄坐标系，字号缩放下才落回 11~12px。 */
const NARROW_TREND: TrendGeom = {
  width: 340,
  height: 268,
  left: 8,
  right: 332,
  top: 16,
  bottom: 224,
  labelY: 252,
  stroke: 2.2,
  point: 3,
};

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

type TrendSeries = {
  id: string;
  label: string;
  color: string;
  daily: number[];
};

/**
 * 趋势折线：指针移到某一天附近，画一条竖线并在这一列的点上标出人数。
 * 卡片里的小图和放大弹层里的大图共用同一套逻辑，只是坐标系不同。
 */
function TrendChart({
  geom,
  large = false,
  days,
  series,
  max,
  formats,
  onActivate,
  activateLabel,
}: {
  geom: TrendGeom;
  large?: boolean;
  days: string[];
  series: TrendSeries[];
  max: number;
  formats: Formatters;
  /** 传了就把整块图做成可点的按钮，点了放大。 */
  onActivate?: () => void;
  activateLabel?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const lastDay = Math.max(0, days.length - 1);
  const x = (index: number) =>
    geom.left + (index * (geom.right - geom.left)) / Math.max(1, lastDay);
  const y = (views: number) =>
    geom.bottom - (views / max) * (geom.bottom - geom.top);
  const caption = large
    ? "visitor-trend-caption visitor-trend-caption-lg"
    : "visitor-trend-caption";

  /** 按指针横坐标取最近的一天：整列都算命中，不必精确压在那个小点上。 */
  const hoverAt = (clientX: number, rect: DOMRect) => {
    if (lastDay <= 0 || rect.width <= 0) {
      setHover(null);
      return;
    }
    const px = ((clientX - rect.left) / rect.width) * geom.width;
    const step = (geom.right - geom.left) / lastDay;
    const index = Math.round((px - geom.left) / step);
    setHover(Math.min(lastDay, Math.max(0, index)));
  };

  const at = hover !== null && hover <= lastDay ? hover : null;
  const rows =
    at === null
      ? []
      : series
          .map((item) => ({ ...item, views: item.daily[at] ?? 0 }))
          .sort((a, b) => b.views - a.views)
          .slice(0, 6);
  const peak = rows.reduce((best, row) => Math.max(best, row.views), 0);
  const leftPct = at === null ? 0 : (x(at) / geom.width) * 100;
  const topPct = at === null ? 0 : (y(peak) / geom.height) * 100;

  const figure = (
    <svg
      className={cn("visitor-trend", large && "visitor-trend-scale")}
      viewBox={`0 0 ${geom.width} ${geom.height}`}
      role="img"
      aria-label={m.dashboard_visitors_trend()}
      onPointerMove={(event) =>
        hoverAt(event.clientX, event.currentTarget.getBoundingClientRect())
      }
      onPointerDown={(event) =>
        hoverAt(event.clientX, event.currentTarget.getBoundingClientRect())
      }
      onPointerLeave={() => setHover(null)}
      onPointerCancel={() => setHover(null)}
    >
      {[0, 0.5, 1].map((step) => (
        <line
          key={step}
          className="visitor-trend-grid"
          x1={geom.left}
          x2={geom.right}
          y1={geom.bottom - step * (geom.bottom - geom.top)}
          y2={geom.bottom - step * (geom.bottom - geom.top)}
        />
      ))}
      <text
        className={caption}
        x={geom.right}
        y={geom.top - 2}
        textAnchor="end"
      >
        {formatCount(max)}
      </text>
      {at === null ? null : (
        <line
          className="visitor-trend-cursor"
          x1={x(at)}
          x2={x(at)}
          y1={geom.top}
          y2={geom.bottom}
        />
      )}
      {series.map((item) => (
        <g key={item.id}>
          <polyline
            fill="none"
            stroke={item.color}
            strokeWidth={geom.stroke}
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
              r={at === day ? geom.point + 1.6 : geom.point}
              fill={item.color}
            />
          ))}
        </g>
      ))}
      {days.map((day, index) =>
        index === 0 ||
        index === lastDay ||
        index === Math.floor(lastDay / 2) ? (
          <text
            key={day}
            className={caption}
            x={x(index)}
            y={geom.labelY}
            textAnchor={
              index === 0 ? "start" : index === lastDay ? "end" : "middle"
            }
          >
            {formats.day.format(new Date(`${day}T00:00:00Z`))}
          </text>
        ) : null,
      )}
    </svg>
  );

  return (
    <div className="visitor-trend-wrap">
      {onActivate ? (
        <button
          type="button"
          className="visitor-trend-trigger"
          aria-label={activateLabel}
          onClick={onActivate}
        >
          {figure}
        </button>
      ) : (
        figure
      )}
      {at === null ? null : (
        <div
          className="visitor-trend-tip"
          style={{
            left: `${leftPct}%`,
            top: `${topPct}%`,
            transform: `translate(${
              leftPct > 74 ? "-100%" : leftPct < 26 ? "0%" : "-50%"
            }, ${topPct < 34 ? "12px" : "calc(-100% - 10px)"})`,
          }}
        >
          <span className="visitor-trend-tip-day">
            {formats.day.format(new Date(`${days[at]}T00:00:00Z`))}
          </span>
          <ul className="visitor-trend-tip-list">
            {rows.map((row) => (
              <li key={row.id}>
                <span
                  className="visitor-swatch"
                  style={{ background: row.color }}
                />
                <span className="visitor-trend-tip-label">{row.label}</span>
                <span className="visitor-trend-tip-value">
                  {formatCount(row.views)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
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
  const [legendExpanded, setLegendExpanded] = useState(false);
  const [zoomed, setZoomed] = useState<"trend" | null>(null);
  /** 窄屏上弹层铺满整屏，趋势图得换成更窄的坐标系，否则字会被缩得看不清。 */
  const [narrow, setNarrow] = useState(false);
  /** 选中的一条，点了图例就只画它自己的走势。 */
  const [selected, setSelected] = useState<string | null>(null);
  const zoomTitleId = useId();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = window.matchMedia("(max-width: 520px)");
    const sync = () => setNarrow(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // Switching tabs shows the new ranking from the top again.
  useEffect(() => {
    setLegendExpanded(false);
    setSelected(null);
  }, [active]);

  const tag = localeTag();
  const formats = useMemo(() => createFormatters(tag), [tag]);
  const dimension =
    visitors.dimensions.find((item) => item.key === active) ??
    visitors.dimensions[0];
  const items: Array<DimensionItem> = dimension?.items ?? [];

  const slices = items.map((item, index) => ({
    id: item.label,
    label: labelOf(active, item.label, formats),
    views: item.views,
    color: COLORS[index % COLORS.length] ?? COLORS[0],
  }));

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
  /**
   * 排行里的每一条都画线，颜色按名次循环取，所以超过 8 条会有重复色。
   * 选中某一条时只画那一条，颜色仍按它在排行里的位置取，和图例对得上。
   */
  const trendItems = (
    selected ? items.filter((item) => item.label === selected) : items
  ).map((item) => {
    const index = items.indexOf(item);
    return { item, color: COLORS[index % COLORS.length] ?? COLORS[0] };
  });
  const trendMax = Math.max(1, ...trendItems.flatMap(({ item }) => item.daily));
  const series: TrendSeries[] = trendItems.map(({ item, color }) => ({
    id: item.label,
    label: labelOf(active, item.label, formats),
    color,
    daily: item.daily,
  }));

  // 图例区固定三行高，条目多时只铺开前两条，其余收在下面的展开按钮后，
  // 这样地区再多也撑不高卡片。
  const collapsible = slices.length > LEGEND_ROWS;
  const visibleSlices =
    collapsible && !legendExpanded ? slices.slice(0, LEGEND_ROWS - 1) : slices;

  const activeLabel = TABS.find((tab) => tab.key === active)?.label() ?? "";

  // 环形图只在这里用，不弹层。
  const donutFigure = (
    <>
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
          <span className="visitor-donut-value">{formatCount(top.views)}</span>
          <span className="visitor-donut-share">
            {share(top.views, visitors.total)}%
          </span>
        </div>
      ) : null}
    </>
  );

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
          <div className="visitor-donut">{donutFigure}</div>

          <div className="visitor-trend-block">
            <p className="visitor-trend-title">
              {selected
                ? `${m.dashboard_visitors_trend()} · ${labelOf(active, selected, formats)}`
                : m.dashboard_visitors_trend()}
            </p>
            <TrendChart
              geom={CARD_TREND}
              days={visitors.days}
              series={series}
              max={trendMax}
              formats={formats}
              onActivate={() => setZoomed("trend")}
              activateLabel={m.dashboard_visitors_zoom({ name: activeLabel })}
            />
          </div>

          <div
            className={cn(
              "visitor-legend",
              collapsible && "is-collapsible",
              legendExpanded && "is-expanded",
            )}
          >
            <ul className="visitor-legend-list">
              {visibleSlices.map((slice) => (
                <li key={slice.id}>
                  <button
                    type="button"
                    className="visitor-legend-item"
                    aria-pressed={selected === slice.id}
                    onClick={() =>
                      setSelected((current) =>
                        current === slice.id ? null : slice.id,
                      )
                    }
                  >
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
                  </button>
                </li>
              ))}
            </ul>
            {collapsible ? (
              <button
                type="button"
                className="visitor-legend-toggle"
                aria-expanded={legendExpanded}
                onClick={() => setLegendExpanded((value) => !value)}
              >
                <span>
                  {legendExpanded
                    ? m.dashboard_visitors_collapse()
                    : m.dashboard_visitors_more({ count: slices.length })}
                </span>
                <ChevronDown
                  size={14}
                  strokeWidth={2}
                  className={cn(
                    "transition-transform",
                    legendExpanded && "rotate-180",
                  )}
                />
              </button>
            ) : null}
          </div>
        </div>
      )}

      <ClientOnly>
        <FuwariModal
          open={zoomed !== null}
          onClose={() => setZoomed(null)}
          className="visitor-zoom"
          labelledBy={zoomTitleId}
        >
          <div className="visitor-zoom-body">
            <div className="visitor-zoom-head">
              <h2 id={zoomTitleId} className="visitor-zoom-title">
                {activeLabel}
              </h2>
              <button
                type="button"
                className="visitor-zoom-close"
                aria-label={m.dashboard_visitors_close()}
                onClick={() => setZoomed(null)}
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>
            <div className="visitor-trend-lg">
              <TrendChart
                geom={narrow ? NARROW_TREND : ZOOM_TREND}
                large
                days={visitors.days}
                series={series}
                max={trendMax}
                formats={formats}
              />
            </div>
            <ul className="visitor-zoom-legend">
              {slices.map((slice) => (
                <li key={slice.id}>
                  <button
                    type="button"
                    className="visitor-legend-item"
                    aria-pressed={selected === slice.id}
                    onClick={() =>
                      setSelected((current) =>
                        current === slice.id ? null : slice.id,
                      )
                    }
                  >
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
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </FuwariModal>
      </ClientOnly>
    </section>
  );
}
