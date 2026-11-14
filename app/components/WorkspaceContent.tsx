
"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type Channel = {
  channelId: string;
  name: string;
  thumbnail: string | null;
  subscribers: string | null;
  totalViews: string | null;
  totalVideos: string | null;
};

type RevenueChannel = {
  channelId: string;
  name: string;
  revenueUSD: number | null;
  status: string;
};

type RevenueResponse = {
  period: {
    startDate: string;
    endDate: string;
    currency: string;
  };
  channels: RevenueChannel[];
  totalRevenueUSD: number;
  complete: boolean;
};

type DailyPoint = { date: string; views: number; revenueUSD: number; subscribersGained?: number; subscribersLost?: number };
type AnalyticsChannel = {
  channelId: string;
  name: string;
  status: string;
  daily: DailyPoint[];
  totalViews: number | null;
  totalRevenueUSD: number | null;
  subscribersGained?: number | null;
  subscribersLost?: number | null;
};
type AnalyticsResponse = {
  period: { startDate: string; endDate: string; currency: string };
  channels: AnalyticsChannel[];
  complete: boolean;
};

type SnapshotChannel = {
  channelId: string;
  name: string;
  status: "ready" | "collecting";
  viewsChange: number | null;
  subscribersChange: number | null;
  videosChange: number | null;
  snapshotTime: string | null;
};
type SnapshotResponse = {
  today: string;
  yesterday: string;
  complete: boolean;
  readyChannels: number;
  totalChannels: number;
  channels: SnapshotChannel[];
  totals: { viewsChange: number; subscribersChange: number | null; videosChange: number };
};

function DailyChart({
  dates,
  series,
  metric,
}: {
  dates: string[];
  series: { name: string; color: string; values: (number | null)[] }[];
  metric: "views" | "revenue";
}) {
  const width = 920;
  const height = 290;
  const left = 58;
  const right = 16;
  const top = 18;
  const bottom = 40;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxValue = Math.max(1, ...series.flatMap((item) => item.values.filter((v): v is number => v !== null)));
  const x = (i: number) => left + (dates.length <= 1 ? plotWidth / 2 : (i / (dates.length - 1)) * plotWidth);
  const y = (v: number) => top + plotHeight * (1 - v / maxValue);
  const tickIndices = [...new Set([0, Math.floor((dates.length - 1) / 2), dates.length - 1])];

  if (!dates.length) {
    return <p className="py-12 text-center text-sm text-slate-400">No daily analytics available for this period.</p>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-4 text-xs text-slate-300">
        {series.map((item) => (
          <span key={item.name} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.name}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Daily ${metric} comparison chart`} className="min-w-[520px] w-full">
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const value = maxValue * (1 - fraction);
            const yy = top + fraction * plotHeight;
            return (
              <g key={fraction}>
                <line x1={left} y1={yy} x2={width - right} y2={yy} stroke="#334155" strokeDasharray="4 5" />
                <text x={left - 9} y={yy + 4} textAnchor="end" fill="#94a3b8" fontSize="12">
                  {metric === "revenue" ? `$${value.toFixed(3)}` : Math.round(value).toLocaleString("en-US")}
                </text>
              </g>
            );
          })}
          {tickIndices.map((i) => (
            <text key={i} x={x(i)} y={height - 12} textAnchor="middle" fill="#94a3b8" fontSize="12">
              {dates[i].slice(5)}
            </text>
          ))}
          {series.map((item) => {
            const segments: string[][] = [];
            let current: string[] = [];
            item.values.forEach((value, i) => {
              if (value === null) {
                if (current.length) segments.push(current);
                current = [];
              } else {
                current.push(`${x(i)},${y(value)}`);
              }
            });
            if (current.length) segments.push(current);
            return (
              <g key={item.name}>
                {segments.map((segment, i) => (
                  <polyline key={i} points={segment.join(" ")} fill="none" stroke={item.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                ))}
                {item.values.map((value, i) => value === null ? null : (
                  <circle key={i} cx={x(i)} cy={y(value)} r="3" fill={item.color}>
                    <title>{`${item.name} · ${dates[i]} · ${metric === "revenue" ? `$${value.toFixed(3)}` : value.toLocaleString("en-US")}`}</title>
                  </circle>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function formatNumber(value: string | number | null) {
  if (value === null || value === undefined) return "N/A";
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString("en-US")
    : "N/A";
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "N/A";
  return "$" + value.toFixed(3);
}

function ChannelAvatar({
  channel,
}: {
  channel: Channel;
}) {
  const [broken, setBroken] = useState(false);

  if (!channel.thumbnail || broken) {
    return (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-600 font-bold">
        ▶
      </div>
    );
  }

  return (
    <img
      src={channel.thumbnail}
      alt={channel.name}
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className="h-11 w-11 shrink-0 rounded-xl object-cover"
    />
  );
}

export default function WorkspaceContent() {
  const pathname = usePathname();
  const isDashboard = pathname === "/";
  const isAnalyticsPage = pathname === "/analytics";
  const isChannelsPage = pathname === "/channels";
  const isComparisonPage = pathname === "/comparison";
  const pageTitle = isAnalyticsPage ? "Analytics" : isChannelsPage ? "My Channels" : isComparisonPage ? "Comparison" : "Dashboard";
  const [channels, setChannels] = useState<Channel[]>([]);
  const [lastMonth, setLastMonth] =
    useState<RevenueResponse | null>(null);
  const [thisMonth, setThisMonth] =
    useState<RevenueResponse | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotResponse | null>(null);
  const [period, setPeriod] = useState<"today" | "yesterday" | "month" | "total">("today");
  const [chartMetric, setChartMetric] = useState<"views" | "revenue">("views");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const responses = await Promise.all([
        fetch("/api/youtube/channels", { cache: "no-store" }),
        fetch("/api/youtube/revenue", { cache: "no-store" }),
        fetch("/api/youtube/revenue/current", {
          cache: "no-store",
        }),
        fetch(`/api/youtube/analytics/period?period=${period}`, { cache: "no-store" }),
        fetch("/api/youtube/snapshot/summary", { cache: "no-store" }),
      ]);

      if (responses.some((r) => r.status === 401)) {
        window.location.href = "/login";
        return;
      }

      if (responses.some((r) => !r.ok)) {
        throw new Error("Unable to load YouTube analytics.");
      }

      const [channelData, lastData, currentData, analyticsData, snapshotData] =
        await Promise.all(responses.map((r) => r.json()));

      setChannels(channelData.channels || []);
      setLastMonth(lastData);
      setThisMonth(currentData);
      setAnalytics(analyticsData);
      setSnapshots(snapshotData);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unknown error"
      );
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  // Check every 15 minutes between 06:00 and 12:00 IST while the page is open.
  // Stop once all connected channels have consecutive-day snapshots.
  // This reads existing data; it does not create a new server snapshot.
  useEffect(() => {
    if (!isDashboard || period !== "today" || snapshots?.complete) return;

    const interval = window.setInterval(() => {
      const istHour = Number(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          hourCycle: "h23",
        }).format(new Date())
      );
      if (istHour >= 6 && istHour < 12 && document.visibilityState === "visible") {
        void loadDashboard();
      }
    }, 15 * 60 * 1000);

    return () => window.clearInterval(interval);
  }, [isDashboard, period, snapshots?.complete, loadDashboard]);

  const totalViews = channels.reduce(
    (sum, c) => sum + Number(c.totalViews || 0),
    0
  );

  const totalSubscribers = channels.reduce(
    (sum, c) => sum + Number(c.subscribers || 0),
    0
  );

  const totalVideos = channels.reduce(
    (sum, c) => sum + Number(c.totalVideos || 0),
    0
  );

  const lastRevenueMap = new Map(
    (lastMonth?.channels || []).map((c) => [
      c.channelId,
      c,
    ])
  );

  const currentRevenueMap = new Map(
    (thisMonth?.channels || []).map((c) => [
      c.channelId,
      c,
    ])
  );

  const allDates = [...new Set((analytics?.channels || [])
    .filter((channel) => channel.status === "success")
    .flatMap((channel) => channel.daily.map((point) => point.date)))].sort();
  const visibleDates = allDates;
  const analyticsByChannel = new Map((analytics?.channels || []).map((channel) => [channel.channelId, channel]));
  const chartColors = ["#60a5fa", "#34d399", "#fbbf24", "#f472b6", "#a78bfa", "#fb923c"];
  const chartSeries = (analytics?.channels || [])
    .filter((channel) => channel.status === "success")
    .map((channel, index) => {
      const points = new Map(channel.daily.map((point) => [point.date, point]));
      return {
        name: channel.name,
        color: chartColors[index % chartColors.length],
        values: visibleDates.map((date) => {
          const point = points.get(date);
          return point ? (chartMetric === "views" ? point.views : point.revenueUSD) : null;
        }),
      };
    });
  const successful = (analytics?.channels || []).filter(c => c.status === "success");
  const periodTotals = successful.flatMap(c => c.daily).reduce((total, point) => ({
    views: total.views + point.views,
    revenueUSD: total.revenueUSD + point.revenueUSD,
    subscribersGained: total.subscribersGained + (point.subscribersGained || 0),
    subscribersLost: total.subscribersLost + (point.subscribersLost || 0),
  }), { views: 0, revenueUSD: 0, subscribersGained: 0, subscribersLost: 0 });
  const isTotal = period === "total";
  const isToday = period === "today";
  const isReported = !isToday && !isTotal && analytics?.complete && successful.length > 0 && visibleDates.length > 0;
  const todayReady = Boolean(snapshots?.complete);
  const todayTotals = snapshots?.totals;
  const todayValue = (value: number | null | undefined) =>
    todayReady && value !== null && value !== undefined ? formatNumber(value) : "Collecting Data";
  const stats = [
    {
      label: isTotal ? "Lifetime Views" : "Period Views",
      value: isTotal ? formatNumber(totalViews) : isToday ? todayValue(todayTotals?.viewsChange) : isReported ? formatNumber(periodTotals.views) : "Pending",
      icon: "▶",
      detail: isTotal ? "All connected channels · lifetime" : isToday ? "Snapshot-to-snapshot views change · 9 AM IST" : "YouTube Analytics reported views",
    },
    {
      label: isTotal ? "Current Subscribers" : "Subscribers Gained",
      value: isTotal ? formatNumber(totalSubscribers) : isToday ? todayValue(todayTotals?.subscribersChange) : isReported ? formatNumber(periodTotals.subscribersGained) : "Pending",
      icon: "👥",
      detail: isTotal ? "Current subscriber count" : isToday ? "Net subscriber change · 9 AM snapshots" : "Gross gains · not net change",
    },
    {
      label: "Estimated Revenue",
      value: isReported ? formatMoney(periodTotals.revenueUSD) : isTotal ? "N/A" : "Pending",
      icon: "💰",
      detail: isTotal ? "Lifetime revenue not provided by this API" : "USD · YouTube estimated earnings",
    },
    {
      label: isTotal ? "Total Videos" : isToday ? "Videos Change" : "Subscribers Net Change",
      value: isTotal ? formatNumber(totalVideos) : isToday ? todayValue(todayTotals?.videosChange) : isReported ? formatNumber(periodTotals.subscribersGained - periodTotals.subscribersLost) : "Pending",
      icon: "📈",
      detail: isTotal ? "Current published video count" : isToday ? "Net video count change" : "Gained minus lost subscribers",
    },
  ];

  return (
    <section id="dashboard" className="w-full min-w-0">
          <header className="mb-9 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-400">
                Workspace / Overview
              </p>
              <h1 className="mt-2 text-2xl font-bold md:text-3xl">
                {pageTitle}
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                {isDashboard ? "Your YouTube performance, all in one place." : `Explore your ${pageTitle.toLowerCase()} data.`}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => void loadDashboard()}
                disabled={loading}
                className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold hover:bg-white/5 disabled:opacity-50"
              >
                {loading ? "Loading..." : "↻ Refresh"}
              </button>

              <a
                href="/api/youtube/connect"
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-500"
              >
                + Connect Channel
              </a>
            </div>
          </header>

          {error && (
            <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {loading && (
            <p className="mb-5 text-sm text-blue-300">
              Loading real YouTube data...
            </p>
          )}

          {(isDashboard || isAnalyticsPage) && (
            <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111a2b] p-4">
            <div>
              <p className="font-semibold">Overview Filter</p>
              <p className="text-xs text-slate-400">Choose the reporting period for the top cards and daily graphs.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                ["today", "Today"], ["yesterday", "Yesterday"],
                ["month", "This Month"], ["total", "Total"],
              ] as const).map(([key, label]) => (
                <button key={key} type="button" onClick={() => setPeriod(key)}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold ${period === key ? "bg-blue-600 text-white" : "bg-white/5 text-slate-300 hover:bg-white/10"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
            </>
          )}
          {(isDashboard) && (
            <>
          <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-white/10 bg-[#111a2b] p-5"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-400">
                    {stat.label}
                  </p>
                  <span className="text-xl">{stat.icon}</span>
                </div>

                <p className="mt-4 text-2xl font-bold">
                  {loading ? "..." : stat.value}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {stat.detail}
                </p>
              </div>
            ))}
          </div>

            </>
          )}
          {(isAnalyticsPage) && (
            <>
          <div id="analytics" className="mb-6 rounded-2xl border border-white/10 bg-[#111a2b] p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold">Daily YouTube Analytics</h2>
                <p className="mt-1 text-xs text-slate-400">
                  {visibleDates.length ? `${visibleDates[0]} to ${visibleDates[visibleDates.length - 1]} · latest available data` : "Waiting for daily data"}
                </p>
              </div>
              <span className="rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-300">{period === "total" ? "Lifetime" : period === "today" ? "Today" : period === "month" ? "This Month" : "Yesterday"}</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-white/5 p-4">
                <p className="text-xs text-slate-400">Period Views · All Channels</p>
                <p className="mt-2 text-2xl font-bold">{loading ? "..." : isToday ? todayValue(todayTotals?.viewsChange) : isReported ? formatNumber(periodTotals.views) : isTotal ? formatNumber(totalViews) : "Pending"}</p>
              </div>
              <div className="rounded-xl bg-white/5 p-4">
                <p className="text-xs text-slate-400">Period Estimated Revenue</p>
                <p className="mt-2 text-2xl font-bold text-emerald-400">{loading ? "..." : isReported ? formatMoney(periodTotals.revenueUSD) : isTotal ? "N/A" : "Pending"}</p>
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              {(["views", "revenue"] as const).map((metric) => (
                <button key={metric} type="button" onClick={() => setChartMetric(metric)}
                  className={`rounded-lg px-4 py-2 text-sm ${chartMetric === metric ? "bg-blue-600 text-white" : "bg-white/5 text-slate-300 hover:bg-white/10"}`}>
                  {metric === "views" ? "Views Graph" : "Revenue Graph"}
                </button>
              ))}
            </div>
            <div className="mt-5">
              {(isToday || isTotal) ? <p className="py-10 text-center text-sm text-slate-400">{isToday ? "Today changes appear in the snapshot tracking section. Select Yesterday or This Month for reported YouTube Analytics graphs." : "Choose a dated period to view the daily graph."}</p> : <DailyChart dates={visibleDates} series={chartSeries} metric={chartMetric} />}
            </div>
            {!analytics?.complete && !loading && !isToday && !isTotal && (
              <p className="mt-3 text-xs text-amber-300">Some channel analytics are unavailable. Totals may be incomplete.</p>
            )}
            <p className="mt-3 text-xs text-slate-500">Dates use UTC. YouTube may report recent days late. Missing dates are not treated as zero.</p>
          </div>

            </>
          )}
          {(isDashboard) && (
            <>
          {isToday && (
            <div className="mb-6 rounded-2xl border border-white/10 bg-[#111a2b] p-5 md:p-6">
              <h2 className="font-semibold">Today · Channel Tracking</h2>
              <p className="mt-1 text-xs text-slate-400">Daily snapshots at 9:00 AM IST · first day collects baseline</p>
              <div className="mt-4 space-y-3">
                {(snapshots?.channels || []).map(channel => (
                  <div key={channel.channelId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/5 p-4">
                    <div>
                      <p className="text-sm font-semibold">{channel.name}</p>
                      <p className="text-xs text-slate-400">{channel.status === "ready" ? "Comparison ready" : "Collecting Data · requires yesterday + today snapshots"}</p>
                    </div>
                    <div className="flex flex-wrap gap-5 text-sm">
                      <span>Views: <b>{channel.status === "ready" ? formatNumber(channel.viewsChange) : "—"}</b></span>
                      <span>Subs (net): <b>{channel.status === "ready" ? formatNumber(channel.subscribersChange) : "—"}</b></span>
                      <span>Videos: <b>{channel.status === "ready" ? formatNumber(channel.videosChange) : "—"}</b></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

            </>
          )}
          {(isDashboard) && (
            <>
          <div className="mb-6 grid gap-5 xl:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-[#111a2b] p-6 xl:col-span-2">
              <h2 className="font-semibold">
                Performance overview
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Combined lifetime statistics
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {[
                  {
                    label: "Total Views",
                    value: formatNumber(totalViews),
                  },
                  {
                    label: "Subscribers",
                    value: formatNumber(totalSubscribers),
                  },
                  {
                    label: "Total Videos",
                    value: formatNumber(totalVideos),
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl bg-white/5 p-5"
                  >
                    <p className="text-xs text-slate-400">
                      {item.label}
                    </p>
                    <p className="mt-3 text-2xl font-bold">
                      {loading ? "..." : item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#111a2b] p-6">
              <h2 className="font-semibold">
                Revenue summary
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Current calendar month
              </p>

              <p className="mt-7 text-3xl font-bold text-emerald-400">
                {loading
                  ? "..."
                  : thisMonth?.complete
                  ? formatMoney(thisMonth.totalRevenueUSD)
                  : "N/A"}
              </p>

              <p className="mt-2 text-xs text-slate-400">
                {thisMonth
                  ? `${thisMonth.period.startDate} to ${thisMonth.period.endDate}`
                  : "No revenue period"}
              </p>

              <div className="mt-7 rounded-xl bg-white/5 p-4">
                <p className="text-xs text-slate-400">
                  Previous month earnings
                </p>
                <p className="mt-2 text-xl font-semibold">
                  {lastMonth?.complete
                    ? formatMoney(lastMonth.totalRevenueUSD)
                    : "N/A"}
                </p>
              </div>

              <p className="mt-4 text-xs text-slate-500">
                Estimated revenue from authorized YouTube Analytics.
              </p>
            </div>
          </div>

            </>
          )}
          {(isChannelsPage) && (
            <>
          <div
            id="channels"
            className="mb-6 rounded-2xl border border-white/10 bg-[#111a2b] p-5 md:p-6"
          >
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">
                  Your YouTube channels
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Real connected channel statistics
                </p>
              </div>
              <span className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
                Live API Data
              </span>
            </div>

            {!loading && channels.length === 0 && (
              <p className="py-8 text-center text-slate-400">
                No channels connected yet.
              </p>
            )}

            <div className="space-y-3">
              {channels.map((channel) => (
                <div
                  key={channel.channelId}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.025] p-4"
                >
                  <div className="flex items-center gap-3">
                    <ChannelAvatar channel={channel} />
                    <div>
                      <p className="text-sm font-semibold">
                        {channel.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {channel.channelId}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-6 text-right">
                    <div>
                      <p className="text-sm font-semibold">
                        {formatNumber(channel.totalViews)}
                      </p>
                      <p className="text-xs text-slate-500">
                        Views
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {formatNumber(channel.subscribers)}
                      </p>
                      <p className="text-xs text-slate-500">
                        Subscribers
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-emerald-400">
                        {currentRevenueMap.get(channel.channelId)
                          ?.status === "success"
                          ? formatMoney(
                              currentRevenueMap.get(
                                channel.channelId
                              )?.revenueUSD
                            )
                          : "N/A"}
                      </p>
                      <p className="text-xs text-slate-500">
                        This Month
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

            </>
          )}
          {(isComparisonPage) && (
            <>
          <div
            id="comparison"
            className="rounded-2xl border border-white/10 bg-[#111a2b] p-5 md:p-6"
          >
            <h2 className="font-semibold">
              Multi-Channel Comparison
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Compare all your connected YouTube channels
            </p>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="border-b border-white/10 text-xs text-slate-400">
                  <tr>
                    <th className="p-3">Channel</th>
                    <th className="p-3 text-right">Views</th>
                    <th className="p-3 text-right">Subscribers</th>
                    <th className="p-3 text-right">Videos</th>
                    <th className="p-3 text-right">This Month</th>
                    <th className="p-3 text-right">Last Month</th>
<th className="p-3 text-right">Period Views</th>
<th className="p-3 text-right">Period Revenue</th>
                  </tr>
                </thead>

                <tbody>
                  {channels.map((channel) => {
                    const current = currentRevenueMap.get(
                      channel.channelId
                    );
                    const previous = lastRevenueMap.get(
                      channel.channelId
                    );

                    const daily = analyticsByChannel.get(channel.channelId);
                    const filtered = (daily?.daily || []).filter((point) => visibleDates.includes(point.date));
                    const periodViews = filtered.reduce((sum, point) => sum + point.views, 0);
                    const periodRevenue = filtered.reduce((sum, point) => sum + point.revenueUSD, 0);

                    return (
                      <tr
                        key={channel.channelId}
                        className="border-b border-white/5"
                      >
                        <td className="p-3 font-semibold">
                          {channel.name}
                        </td>
                        <td className="p-3 text-right">
                          {formatNumber(channel.totalViews)}
                        </td>
                        <td className="p-3 text-right">
                          {formatNumber(channel.subscribers)}
                        </td>
                        <td className="p-3 text-right">
                          {formatNumber(channel.totalVideos)}
                        </td>
                        <td className="p-3 text-right text-emerald-400">
                          {current?.status === "success"
                            ? formatMoney(current.revenueUSD)
                            : "N/A"}
                        </td>
                        <td className="p-3 text-right text-emerald-400">
                          {previous?.status === "success"
                            ? formatMoney(previous.revenueUSD)
                            : "N/A"}
                        </td>
                        <td className="p-3 text-right">{daily?.status === "success" ? formatNumber(periodViews) : "N/A"}</td>
                        <td className="p-3 text-right text-emerald-400">{daily?.status === "success" ? formatMoney(periodRevenue) : "N/A"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="mt-5 text-xs text-slate-500">
              Revenue values are estimated. Current and previous
              month have different date ranges, so they should
              not be treated as a like-for-like growth comparison.
            </p>
          </div>

            </>
          )}
          <p className="mt-6 text-center text-xs text-slate-600">
            Creator Command Center © 2026
            {lastUpdated && ` · Updated ${lastUpdated}`}
          </p>
    </section>
  );
}
