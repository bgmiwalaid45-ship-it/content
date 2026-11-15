
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

function getIST(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
  };
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET missing" },
      { status: 500 }
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const ist = getIST();

  // Runs hourly between 00:00 and 10:59 IST.
  if (ist.hour > 10) {
    return NextResponse.json({
      status: "outside_window",
      date: ist.date,
    });
  }

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const apiKey = process.env.GOOGLE_YOUTUBE_API_KEY;

    if (!url || !serviceKey || !apiKey) {
      return NextResponse.json(
        { error: "Missing environment variables" },
        { status: 500 }
      );
    }

    const supabase = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: channels, error: channelError } = await supabase
      .from("youtube_channels")
      .select("user_id,channel_id,channel_name");

    if (channelError) throw channelError;

    const results = [];

    for (const channel of channels ?? []) {
      try {
        const endpoint = new URL(
          "https://www.googleapis.com/youtube/v3/channels"
        );

        endpoint.searchParams.set("part", "statistics");
        endpoint.searchParams.set("id", channel.channel_id);
        endpoint.searchParams.set("key", apiKey);

        const response = await fetch(endpoint.toString(), {
          cache: "no-store",
          signal: AbortSignal.timeout(12000),
        });

        if (!response.ok) {
          throw new Error(`YouTube API: ${response.status}`);
        }

        const payload = await response.json();
        const stats = payload.items?.[0]?.statistics;

        if (!stats) throw new Error("Statistics unavailable");

        const views = Number(stats.viewCount);
        const videos = Number(stats.videoCount);
        const subscribers =
          stats.hiddenSubscriberCount === true ||
          stats.subscriberCount == null
            ? null
            : Number(stats.subscriberCount);

        if (
          !Number.isSafeInteger(views) ||
          !Number.isSafeInteger(videos) ||
          (subscribers !== null &&
            !Number.isSafeInteger(subscribers))
        ) {
          throw new Error("Invalid channel statistics");
        }

        const snapshotTime = new Date().toISOString();

        // Save every hourly observation.
        const { error: hourlyError } = await supabase
          .from("channel_hourly_snapshots")
          .insert({
            user_id: channel.user_id,
            channel_id: channel.channel_id,
            snapshot_time: snapshotTime,
            total_views: views,
            subscribers,
            total_videos: videos,
          });

        if (hourlyError) throw hourlyError;

        // Preserve one daily snapshot per channel.
        const { error: dailyError } = await supabase
          .from("channel_daily_snapshots")
          .upsert(
            {
              user_id: channel.user_id,
              channel_id: channel.channel_id,
              snapshot_date: ist.date,
              snapshot_time: snapshotTime,
              total_views: views,
              subscribers,
              total_videos: videos,
            },
            {
              onConflict: "user_id,channel_id,snapshot_date",
              ignoreDuplicates: true,
            }
          );

        if (dailyError) throw dailyError;

        results.push({
          channelId: channel.channel_id,
          status: "saved",
        });
      } catch (error) {
        console.error(
          "Snapshot failed:",
          channel.channel_id,
          error
        );

        results.push({
          channelId: channel.channel_id,
          status: "failed",
        });
      }
    }

    const failed = results.filter(
      (r) => r.status === "failed"
    ).length;

    return NextResponse.json({
      date: ist.date,
      checked: results.length,
      saved: results.length - failed,
      failed,
      complete: failed === 0,
      results,
    });
  } catch (error) {
    console.error("Snapshot API error:", error);

    return NextResponse.json(
      { error: "Snapshot collection failed" },
      { status: 500 }
    );
  }
}
