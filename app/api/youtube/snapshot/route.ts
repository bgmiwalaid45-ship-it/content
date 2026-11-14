import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";


export const maxDuration = 60;

function getISTParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const part = (name: string) => parts.find((p) => p.type === name)?.value ?? "";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, hour: Number(part("hour")), minute: Number(part("minute")) };
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ist = getISTParts();
  // This endpoint is for the scheduled collection window only.
  if (ist.hour < 6 || ist.hour >= 12) {
    return NextResponse.json({ status: "outside_window", snapshotDate: ist.date, timezone: "Asia/Kolkata" });
  }

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const apiKey = process.env.GOOGLE_YOUTUBE_API_KEY;
    if (!url || !serviceKey || !apiKey) {
      return NextResponse.json({ error: "Required server environment variables are missing" }, { status: 500 });
    }

    const supabase = createAdminClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: channels, error: channelError } = await supabase
      .from("youtube_channels").select("user_id,channel_id,channel_name");
    if (channelError) throw new Error(channelError.message);

    const { data: existing, error: existingError } = await supabase
      .from("channel_daily_snapshots").select("user_id,channel_id")
      .eq("snapshot_date", ist.date);
    if (existingError) throw new Error(existingError.message);

    const keyFor = (userId: string, channelId: string) => JSON.stringify([userId, channelId]);
    const alreadySaved = new Set((existing ?? []).map((r) => keyFor(r.user_id, r.channel_id)));
    const pending = (channels ?? []).filter((c) => !alreadySaved.has(keyFor(c.user_id, c.channel_id)));

    // Sequential requests keep API load predictable and reduce bursts.
    const results: Array<{ channelId: string; name: string; status: string }> = [];
    for (const channel of pending) {
      try {
        const endpoint = new URL("https://www.googleapis.com/youtube/v3/channels");
        endpoint.searchParams.set("part", "statistics");
        endpoint.searchParams.set("id", channel.channel_id);
        endpoint.searchParams.set("key", apiKey);
        const response = await fetch(endpoint.toString(), { cache: "no-store", signal: AbortSignal.timeout(12000) });
        if (!response.ok) throw new Error(`YouTube API returned ${response.status}`);
        const payload = await response.json();
        const stats = payload.items?.[0]?.statistics;
        if (!stats) throw new Error("Channel statistics unavailable");
        const totalViews = Number(stats.viewCount);
        const totalVideos = Number(stats.videoCount);
        const subscribers = stats.hiddenSubscriberCount === true || stats.subscriberCount == null ? null : Number(stats.subscriberCount);
        if (!Number.isSafeInteger(totalViews) || !Number.isSafeInteger(totalVideos) ||
            (subscribers !== null && !Number.isSafeInteger(subscribers))) throw new Error("Invalid statistics");

        const { error: saveError } = await supabase.from("channel_daily_snapshots").upsert({
          user_id: channel.user_id, channel_id: channel.channel_id,
          snapshot_date: ist.date, snapshot_time: new Date().toISOString(),
          total_views: totalViews, subscribers, total_videos: totalVideos,
        }, { onConflict: "user_id,channel_id,snapshot_date", ignoreDuplicates: true });
        if (saveError) throw new Error(saveError.message);
        results.push({ channelId: channel.channel_id, name: channel.channel_name, status: "saved" });
      } catch (error) {
        console.error("Snapshot failed", channel.channel_id, error instanceof Error ? error.message : "Unknown error");
        results.push({ channelId: channel.channel_id, name: channel.channel_name, status: "failed" });
      }
    }

    const saved = results.filter((r) => r.status === "saved").length;
    const failed = results.filter((r) => r.status === "failed").length;
    return NextResponse.json({
      snapshotDate: ist.date, totalChannels: (channels ?? []).length,
      previouslySaved: (channels ?? []).length - pending.length,
      newlySaved: saved, failed, complete: failed === 0,
      results,
    });
  } catch (error) {
    console.error("Snapshot API error", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Snapshot failed" }, { status: 500 });
  }
}
