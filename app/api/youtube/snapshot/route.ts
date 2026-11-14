
import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";


function getISTDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function GET(request: NextRequest) {
  try {
    // Only allow requests with the scheduler secret
    const secret = process.env.CRON_SECRET;

    if (!secret) {
      return NextResponse.json(
        { error: "CRON_SECRET is not configured" },
        { status: 500 }
      );
    }

    const authorization = request.headers.get("authorization");

    if (authorization !== `Bearer ${secret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data: channels, error: channelError } = await supabase
      .from("youtube_channels")
      .select("user_id,channel_id,channel_name");

    if (channelError) {
      throw new Error(channelError.message);
    }

    const apiKey = process.env.GOOGLE_YOUTUBE_API_KEY;

    if (!apiKey) {
      throw new Error("GOOGLE_YOUTUBE_API_KEY is missing");
    }

    const snapshotDate = getISTDate();

    const results = await Promise.all(
      (channels || []).map(async (channel) => {
        try {
          const url = new URL(
            "https://www.googleapis.com/youtube/v3/channels"
          );

          url.searchParams.set("part", "statistics");
          url.searchParams.set("id", channel.channel_id);
          url.searchParams.set("key", apiKey);

          const response = await fetch(url.toString(), {
            cache: "no-store",
          });

          if (!response.ok) {
            throw new Error(
              `YouTube API returned ${response.status}`
            );
          }

          const data = await response.json();
          const stats = data.items?.[0]?.statistics;

          if (!stats) {
            throw new Error("Channel statistics unavailable");
          }

          const totalViews = Number(stats.viewCount);
          const totalVideos = Number(stats.videoCount);
          const subscribers =
            stats.hiddenSubscriberCount === true ||
            stats.subscriberCount == null
              ? null
              : Number(stats.subscriberCount);

          if (
            !Number.isSafeInteger(totalViews) ||
            !Number.isSafeInteger(totalVideos) ||
            (subscribers !== null &&
              !Number.isSafeInteger(subscribers))
          ) {
            throw new Error("Invalid channel statistics");
          }

          const { error: saveError } = await supabase
            .from("channel_daily_snapshots")
            .upsert(
              {
                user_id: channel.user_id,
                channel_id: channel.channel_id,
                snapshot_date: snapshotDate,
                snapshot_time: new Date().toISOString(),
                total_views: totalViews,
                subscribers,
                total_videos: totalVideos,
              },
              {
                onConflict: "user_id,channel_id,snapshot_date",
              }
            );

          if (saveError) {
            throw new Error(saveError.message);
          }

          return {
            channelId: channel.channel_id,
            name: channel.channel_name,
            status: "saved",
          };
        } catch (error) {
          console.error(
            "Snapshot failed:",
            channel.channel_id,
            error instanceof Error ? error.message : "Unknown error"
          );

          return {
            channelId: channel.channel_id,
            name: channel.channel_name,
            status: "failed",
          };
        }
      })
    );

    return NextResponse.json({
      snapshotDate,
      totalChannels: results.length,
      saved: results.filter((r) => r.status === "saved").length,
      results,
    });
  } catch (error) {
    console.error(
      "Snapshot API error:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      { error: "Snapshot failed" },
      { status: 500 }
    );
  }
}
