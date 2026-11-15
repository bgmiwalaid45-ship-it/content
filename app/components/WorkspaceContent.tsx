"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import "./workspace-premium.css";

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
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [permanentPanelOpen, setPermanentPanelOpen] = useState(false);
  const [permanentLinks, setPermanentLinks] = useState<{ id: string; name: string; created_at: string }[]>([]);
  const [permanentUrl, setPermanentUrl] = useState("");
  const [permanentBusy, setPermanentBusy] = useState(false);
  const [permanentError, setPermanentError] = useState("");
  const [permanentMessage, setPermanentMessage] = useState("");

  const loadPermanentLinks = async () => {
    setPermanentBusy(true);
    setPermanentError("");
    try {
      const response = await fetch("/api/youtube/permanent-link", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load links");
      setPermanentLinks(data.links || []);
    } catch (err) {
      setPermanentError(err instanceof Error ? err.message : "Unable to load links");
    } finally {
      setPermanentBusy(false);
    }
  };

  const createPermanentLink = async () => {
    setPermanentBusy(true);
    setPermanentError("");
    setPermanentMessage("");
    try {
      const response = await fetch("/api/youtube/permanent-link", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create link");
      setPermanentUrl(data.url);
      setPermanentLinks((current) => [{ id: data.id, name: data.name, created_at: data.createdAt }, ...current]);
      setPermanentMessage("Link created. Copy and save it now; it cannot be retrieved later.");
    } catch (err) {
      setPermanentError(err instanceof Error ? err.message : "Unable to create link");
    } finally {
      setPermanentBusy(false);
    }
  };

  const revokePermanentLink = async (id: string) => {
    if (!window.confirm("Revoke this permanent link? New connections using it will be blocked.")) return;
    setPermanentBusy(true);
    setPermanentError("");
    setPermanentMessage("");
    try {
      const response = await fetch("/api/youtube/permanent-link", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to revoke link");
      setPermanentLinks((current) => current.filter((link) => link.id !== id));
      setPermanentMessage("Link revoked successfully.");
      setPermanentUrl("");
    } catch (err) {
      setPermanentError(err instanceof Error ? err.message : "Unable to revoke link");
    } finally {
      setPermanentBusy(false);
    }
  };

  const [channels, setChannels] = useState<Channel[]>([]);
  const [lastMonth, setLastMonth] =
    useState<RevenueResponse | null>(null);
  const [thisMonth, setThisMonth] =
    useState<RevenueResponse | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotResponse | null>(null);
const [revenueGoal, setRevenueGoal] = useState<number | null>(null);
const [goalInput, setGoalInput] = useState("");
const [goalSaving, setGoalSaving] = useState(false);
const [goalMessage, setGoalMessage] = useState("");
  const [period, setPeriod] = useState<"today" | "yesterday" | "month" | "total">("today");
  const [chartMetric, setChartMetric] = useState<"views" | "revenue">("views");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

const disconnectChannel = async (channel: Channel) => {
  const confirmed = window.confirm(
    `Disconnect "${channel.name}"?\n\nThis channel will be removed from your dashboard.`
  );

  if (!confirmed) return;

  setDisconnectingId(channel.channelId);
  setError("");

  try {
    const response = await fetch("/api/youtube/disconnect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channelId: channel.channelId,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to disconnect channel");
    }

    await loadDashboard();
  } catch (err) {
    setError(
      err instanceof Error ? err.message : "Disconnect failed"
    );
  } finally {
    setDisconnectingId(null);
  }
};


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
fetch("/api/revenue-goals", { cache: "no-store" }),
      ]);

      if (responses.some((r) => r.status === 401)) {
        window.location.href = "/login";
        return;
      }

      if (responses.some((r) => !r.ok)) {
        throw new Error("Unable to load YouTube analytics.");
      }

      const [
  channelData,
  lastData,
  currentData,
  analyticsData,
  snapshotData,
  goalData,
] = await Promise.all(responses.map((r) => r.json()));

      setChannels(channelData.channels || []);
      setLastMonth(lastData);
      setThisMonth(currentData);
      setAnalytics(analyticsData);
      setSnapshots(snapshotData);
const combinedGoal = goalData.goals?.find(
  (goal: { channel_id: string; target_usd: number }) =>
    goal.channel_id === "all"
);

const savedTarget = combinedGoal
  ? Number(combinedGoal.target_usd)
  : null;

setRevenueGoal(savedTarget);
setGoalInput(savedTarget !== null ? String(savedTarget) : "");
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unknown error"
      );
    } finally {
      setLoading(false);
    }
  }, [period]);

  const saveRevenueGoal = async () => {
    const target = Number(goalInput);
    if (!goalInput.trim() || !Number.isFinite(target) || target <= 0 || target > 9999999999.99 || !/^\d+(\.\d{1,2})?$/.test(goalInput.trim())) {
      setGoalMessage("Enter a valid goal amount (up to 2 decimal places).");
      return;
    }

    setGoalSaving(true);
    setGoalMessage("");
    try {
      const response = await fetch("/api/revenue-goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUSD: target, channelId: "all" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save goal");
      const saved = Number(result.goal.target_usd);
      setRevenueGoal(saved);
      setGoalInput(String(saved));
      setGoalMessage("Monthly goal saved successfully!");
    } catch (err) {
      setGoalMessage(err instanceof Error ? err.message : "Unable to save goal");
    } finally {
      setGoalSaving(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  // Check every 15 minutes between 06:00 and 12:00 IST while the page is open.
  // Stop once all connected channels have consecutive-day snapshots.
  // This reads existing data; it does not create a new server snapshot.
  useEffect(() => {
   if (!isDashboard || period !== "today") return;

    const interval = window.setInterval(() => {
      const istHour = Number(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          hourCycle: "h23",
        }).format(new Date())
      );
      if (document.visibilityState === "visible") {
        void loadDashboard();
      }
    }, 5 * 60 * 1000);

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
      label: isTotal ? "Lifetime views" : "Period views",
      value: isTotal ? formatNumber(totalViews) : isToday ? todayValue(todayTotals?.viewsChange) : isReported ? formatNumber(periodTotals.views) : "Pending",
    detail: isTotal ? "Across connected channels" : isToday ? "Growth since previous saved baseline" : "YouTube Analytics",
      accent: "blue",
      symbol: "↗",
    },
    {
      label: isTotal ? "Total subscribers" : "Subscribers gained",
      value: isTotal ? formatNumber(totalSubscribers) : isToday ? todayValue(todayTotals?.subscribersChange) : isReported ? formatNumber(periodTotals.subscribersGained) : "Pending",
      detail: isTotal ? "Current combined subscriber count" : isToday ? "Net change from daily snapshots" : "Gross subscribers gained",
      accent: "violet",
      symbol: "◎",
    },
    {
      label: "Estimated revenue",
      value: isReported ? formatMoney(periodTotals.revenueUSD) : isTotal ? "N/A" : "Pending",
      detail: isTotal ? "Lifetime revenue not available" : "USD · reported YouTube earnings",
      accent: "emerald",
      symbol: "$",
    },
    {
      label: isTotal ? "Published videos" : isToday ? "Videos change" : "Net subscribers",
      value: isTotal ? formatNumber(totalVideos) : isToday ? todayValue(todayTotals?.videosChange) : isReported ? formatNumber(periodTotals.subscribersGained - periodTotals.subscribersLost) : "Pending",
      detail: isTotal ? "Across all connected channels" : isToday ? "Daily snapshot comparison" : "Gained minus lost",
      accent: "amber",
      symbol: "▤",
    },
  ];

  return (
    <section id="dashboard" className="cc-premium w-full min-w-0 pb-8">
          <header className="cc-page-header mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-400">
                CREATOR COMMAND CENTER  /  WORKSPACE
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-white md:text-4xl">
                {pageTitle}
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                {isDashboard ? "Track performance, revenue, and growth across your channels." : `Manage your ${pageTitle.toLowerCase()} in one workspace.`}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => void loadDashboard()}
                disabled={loading}
                className="rounded-xl border border-white/10 bg-[#111827] px-4 py-3 text-sm font-semibold transition-colors hover:bg-white/10 disabled:opacity-50"
              >
                {loading ? "Loading..." : "↻ Refresh"}
              </button>

              <button
                type="button"
                onClick={() => setConnectModalOpen(true)}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold shadow-lg shadow-blue-900/20 transition-colors hover:bg-blue-500"
              >
                + Connect Channel
              </button>

</div>
          </header>

{connectModalOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setConnectModalOpen(false); }}>
    <div role="dialog" aria-modal="true" aria-label="Connect YouTube Channel" className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#111a2b] p-6 shadow-2xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Connect YouTube Channel</h2>
        <button type="button" onClick={() => setConnectModalOpen(false)} aria-label="Close" className="rounded-lg px-3 py-2 text-slate-300 hover:bg-white/10">✕</button>
      </div>
      <a href="/api/youtube/connect" className="mb-3 block rounded-xl border border-blue-500/30 bg-blue-500/10 p-5 hover:bg-blue-500/20">
        <span className="block font-semibold text-blue-200">Connect My Channel</span>
        <span className="mt-1 block text-sm text-slate-400">Connect your own YouTube channel through Google.</span>
      </a>
      <button type="button" onClick={() => { setConnectModalOpen(false); setPermanentPanelOpen(true); void loadPermanentLinks(); }} className="w-full rounded-xl border border-white/10 bg-white/5 p-5 text-left hover:bg-white/10">
        <span className="block font-semibold">Connect via Permanent Link</span>
        <span className="mt-1 block text-sm text-slate-400">Create a reusable link for creators to authorize their channels.</span>
      </button>
      <p className="mt-4 text-xs text-slate-400">Creators must approve Google access and confirm before their channel is added.</p>
    </div>
  </div>
)}
{permanentPanelOpen && (
  <div className="mb-6 rounded-2xl border border-blue-500/30 bg-[#111a2b] p-5 md:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold">Permanent Connection Links</h2>
        <p className="mt-1 text-sm text-slate-400">Reusable invitations. Each creator must authorize and confirm separately.</p>
      </div>
      <button type="button" onClick={() => setPermanentPanelOpen(false)} className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/10">Close</button>
    </div>
    <div className="mt-5 flex flex-wrap gap-3">
      <button type="button" onClick={() => void createPermanentLink()} disabled={permanentBusy} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50">{permanentBusy ? "Please wait..." : "+ Create Permanent Link"}</button>
      <button type="button" onClick={() => void loadPermanentLinks()} disabled={permanentBusy} className="rounded-xl border border-white/10 px-4 py-3 text-sm hover:bg-white/10 disabled:opacity-50">Refresh Links</button>
    </div>
    {permanentError && <p role="alert" className="mt-4 text-sm text-red-400">{permanentError}</p>}
    {permanentMessage && <p className="mt-4 text-sm text-emerald-400">{permanentMessage}</p>}
    {permanentUrl && (
      <div className="mt-5 rounded-xl border border-blue-500/20 bg-slate-950/50 p-4">
        <p className="mb-2 text-sm font-semibold">New Link — Save It Now</p>
        <div className="flex flex-wrap gap-2">
          <input readOnly aria-label="Permanent connection URL" value={permanentUrl} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm" />
          <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(permanentUrl); setPermanentMessage("Link copied."); } catch { setPermanentError("Copy failed. Select the URL and copy it manually."); } }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold">Copy Link</button>
        </div>
        <p className="mt-2 text-xs text-amber-300">The URL is shown only when created. Store it securely; existing links cannot be displayed again.</p>
      </div>
    )}
    <h3 className="mt-6 font-semibold">Active Links ({permanentLinks.length})</h3>
    {permanentLinks.length === 0 && <p className="mt-3 text-sm text-slate-400">No active links found. Create one above.</p>}
    <div className="mt-3 space-y-2">
      {permanentLinks.map((link) => (
        <div key={link.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
          <div>
            <p className="text-sm font-semibold">{link.name}</p>
            <p className="text-xs text-slate-400">Created {new Date(link.created_at).toLocaleString()}</p>
          </div>
          <button type="button" disabled={permanentBusy} onClick={() => void revokePermanentLink(link.id)} className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50">Revoke</button>
        </div>
      ))}
    </div>
  </div>
)}

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
            <div className="cc-period mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#111827] px-5 py-4 shadow-sm">
              <div>
                <p className="text-sm font-semibold text-white">Reporting period</p>
                <p className="mt-1 text-xs text-slate-400">Choose the data range for performance metrics.</p>
              </div>
              <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-[#080f1e] p-1">
                {([
                  ["today", "Today"], ["yesterday", "Yesterday"],
                  ["month", "This month"], ["total", "Lifetime"],
                ] as const).map(([key, label]) => (
                  <button key={key} type="button" onClick={() => setPeriod(key)}
                    aria-pressed={period === key}
                    className={`rounded-lg px-4 py-2.5 text-xs font-semibold transition-colors ${period === key ? "bg-blue-600 text-white shadow-lg shadow-blue-900/30" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {isDashboard && (
            <div className="cc-kpi-grid mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="cc-kpi-card relative overflow-hidden rounded-2xl border border-white/10 bg-[#111827] p-5 shadow-sm transition-colors hover:border-white/20">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-slate-400">{stat.label}</p>
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-semibold ${
                      stat.accent === "blue" ? "bg-blue-500/10 text-blue-400" :
                      stat.accent === "violet" ? "bg-violet-500/10 text-violet-400" :
                      stat.accent === "emerald" ? "bg-emerald-500/10 text-emerald-400" :
                      "bg-amber-500/10 text-amber-400"
                    }`}>{stat.symbol}</span>
                  </div>
                  <p className={`mt-5 text-2xl font-bold tracking-tight md:text-3xl ${stat.accent === "emerald" && stat.value.startsWith("$") ? "text-emerald-400" : "text-white"}`}>
                    {loading ? "—" : stat.value}
                  </p>
                  <p className="mt-3 min-h-8 text-xs leading-relaxed text-slate-500">{stat.detail}</p>
                </div>
              ))}
            </div>
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
          {isDashboard && (
            <>
              <div className="cc-goal-card mb-6 rounded-2xl border border-white/10 bg-[#111827] p-5 shadow-sm md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-white">Monthly Revenue Goal</h2>
                    <p className="mt-1 text-xs text-slate-400">Combined target for all connected channels · {thisMonth?.period.startDate.slice(0, 7) || "Loading..."}</p>
                  </div>
                  <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300">USD</span>
                </div>
                <form className="mt-5 flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); void saveRevenueGoal(); }}>
                  <label className="min-w-[180px] flex-1 text-xs font-medium text-slate-300">
                    Monthly target ($)
                    <input type="number" min="0.01" max="9999999999.99" step="0.01" required value={goalInput} onChange={(event) => { setGoalInput(event.target.value); setGoalMessage(""); }} placeholder="e.g. 500" className="mt-2 block w-full rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3 text-sm text-white outline-none focus:border-blue-500" />
                  </label>
                  <button type="submit" disabled={goalSaving} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">{goalSaving ? "Saving..." : revenueGoal === null ? "Set Goal" : "Update Goal"}</button>
                </form>
                {goalMessage && <p role="status" className="mt-3 text-xs text-blue-300">{goalMessage}</p>}
                {revenueGoal !== null && (() => {
                  const reported = thisMonth?.complete ? thisMonth.totalRevenueUSD : null;
                  const remaining = reported === null ? null : Math.max(0, revenueGoal - reported);
                  const progress = reported === null || revenueGoal <= 0 ? null : Math.min(100, (reported / revenueGoal) * 100);
                  const now = new Date();
                  const daysRemaining = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate() - now.getUTCDate();
                  return (
                    <div className="mt-6">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-2xl font-bold text-white">{reported === null ? "Revenue unavailable" : formatMoney(reported)} <span className="text-base font-normal text-slate-400">/ {formatMoney(revenueGoal)}</span></p>
                        <p className="text-sm font-semibold text-blue-300">{progress === null ? "—" : `${progress.toFixed(1)}% achieved`}</p>
                      </div>
                      <div role="progressbar" aria-label="Revenue goal progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress ?? 0} className="mt-4 h-3 overflow-hidden rounded-full bg-slate-700">
                        <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${progress ?? 0}%` }} />
                      </div>
                      <div className="cc-goal-stats mt-4 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl bg-[#0b1220] p-4"><p className="text-xs text-slate-400">Reported revenue</p><p className="mt-2 text-lg font-bold text-emerald-400">{reported === null ? "N/A" : formatMoney(reported)}</p></div>
                        <div className="rounded-xl bg-[#0b1220] p-4"><p className="text-xs text-slate-400">Remaining target</p><p className="mt-2 text-lg font-bold text-white">{remaining === null ? "N/A" : formatMoney(remaining)}</p></div>
                        <div className="rounded-xl bg-[#0b1220] p-4"><p className="text-xs text-slate-400">Daily average needed</p><p className="mt-2 text-lg font-bold text-white">{remaining === null ? "N/A" : daysRemaining > 0 ? formatMoney(remaining / daysRemaining) : remaining === 0 ? "$0.000" : "No days left"}</p></div>
                      </div>
                      <p className="mt-4 text-xs text-slate-500">Based on reported estimated YouTube revenue through {thisMonth?.period.endDate || "the latest available date"}. Reporting may be delayed; daily average uses remaining UTC calendar days.</p>
                    </div>
                  );
                })()}
              </div>

              <div className="cc-dashboard-grid mb-6 grid gap-5 xl:grid-cols-3">
                <div className="cc-panel rounded-2xl border border-white/10 bg-[#111827] p-5 shadow-sm md:p-6 xl:col-span-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-white">Performance trends</h2>
                      <p className="mt-1 text-xs text-slate-400">Daily views and estimated revenue across connected channels</p>
                    </div>
                    <div className="flex gap-1 rounded-lg border border-white/10 bg-[#0b1220] p-1">
                      {(["views", "revenue"] as const).map((metric) => (
                        <button key={metric} type="button" onClick={() => setChartMetric(metric)}
                          className={`rounded-md px-3 py-2 text-xs font-semibold ${chartMetric === metric ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"}`}>
                          {metric === "views" ? "Views" : "Revenue"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-6">
                    {isToday || isTotal
                      ? <div className="flex min-h-[265px] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#0b1220]/50 px-6 text-center">
                          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-xl text-blue-400">↗</div>
                          <p className="font-semibold text-slate-200">Daily trend chart</p>
                          <p className="mt-2 max-w-sm text-sm text-slate-400">Select Yesterday or This month to view reported daily analytics. Today uses snapshot tracking.</p>
                        </div>
                      : <DailyChart dates={visibleDates} series={chartSeries} metric={chartMetric} />}
                  </div>
                </div>
                <div className="cc-panel rounded-2xl border border-white/10 bg-[#111827] p-5 shadow-sm md:p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-white">Revenue overview</h2>
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">USD</span>
                  </div>
                  <p className="mt-6 text-xs font-medium uppercase tracking-wider text-slate-400">Current month</p>
                  <p className="mt-2 text-4xl font-bold tracking-tight text-emerald-400">
                    {loading ? "—" : thisMonth?.complete ? formatMoney(thisMonth.totalRevenueUSD) : "N/A"}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {thisMonth ? `${thisMonth.period.startDate} – ${thisMonth.period.endDate}` : "Reporting period unavailable"}
                  </p>
                  <div className="my-6 h-px bg-white/10" />
                  <p className="text-xs text-slate-400">Previous month</p>
                  <p className="mt-2 text-2xl font-bold text-white">
                    {lastMonth?.complete ? formatMoney(lastMonth.totalRevenueUSD) : "N/A"}
                  </p>
                  <p className="mt-5 rounded-xl bg-[#0b1220] p-3 text-xs leading-relaxed text-slate-400">
                    Revenue is estimated and may change when YouTube finalizes earnings.
                  </p>
                </div>
              </div>

              <div className="cc-dashboard-grid mb-6 grid gap-5 xl:grid-cols-3">
                <div className="cc-panel rounded-2xl border border-white/10 bg-[#111827] p-5 shadow-sm md:p-6 xl:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-white">Connected channels</h2>
                      <p className="mt-1 text-xs text-slate-400">Lifetime audience and video performance</p>
                    </div>
                    <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300">{channels.length} connected</span>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {[
                      { label: "Total views", value: formatNumber(totalViews) },
                      { label: "Subscribers", value: formatNumber(totalSubscribers) },
                      { label: "Published videos", value: formatNumber(totalVideos) },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl border border-white/5 bg-[#0b1220] p-4">
                        <p className="text-xs text-slate-400">{item.label}</p>
                        <p className="mt-3 text-xl font-bold tracking-tight text-white">{loading ? "—" : item.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 space-y-2">
                    {channels.map((channel) => (
                      <div key={channel.channelId} className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.025] p-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <ChannelAvatar channel={channel} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">{channel.name}</p>
                            <p className="text-xs text-slate-500">{formatNumber(channel.subscribers)} subscribers</p>
                          </div>
                        </div>
                        <p className="shrink-0 text-sm font-semibold text-slate-200">{formatNumber(channel.totalViews)} <span className="font-normal text-slate-500">views</span></p>
                      </div>
                    ))}
                    {!loading && channels.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No channels connected yet.</p>}
                  </div>
                </div>
                <div className="cc-panel rounded-2xl border border-white/10 bg-[#111827] p-5 shadow-sm md:p-6">
                  <h2 className="text-base font-semibold text-white">Daily tracking</h2>
                  <p className="mt-1 text-xs text-slate-400">
  Hourly snapshots · 12 AM–10 AM IST
</p>
                  <div className="mt-6 flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${snapshots?.complete ? "bg-emerald-400" : "bg-amber-400"}`} />
                    <p className="text-sm font-semibold text-slate-200">{snapshots?.complete ? "Snapshot ready" : "Collecting baseline"}</p>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-slate-400">
                    {snapshots?.complete ? "Latest available snapshot compared with the previous saved baseline." : "Daily changes appear after consecutive snapshots have been collected."}
                  </p>
                  <div className="mt-5 space-y-3">
                    {(snapshots?.channels || []).slice(0, 5).map((channel) => (
                      <div key={channel.channelId} className="rounded-xl bg-[#0b1220] p-3">
                        <p className="truncate text-xs font-semibold text-slate-200">{channel.name}</p>
                        <div className="mt-2 flex justify-between gap-2 text-xs text-slate-400">
                          <span>Views {channel.status === "ready" ? formatNumber(channel.viewsChange) : "—"}</span>
                          <span>Subs {channel.status === "ready" ? formatNumber(channel.subscribersChange) : "—"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
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

<button
  type="button"
  onClick={() => void disconnectChannel(channel)}
  disabled={disconnectingId === channel.channelId}
  className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50"
>
  {disconnectingId === channel.channelId
    ? "Disconnecting..."
    : "Disconnect"}
</button>

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
