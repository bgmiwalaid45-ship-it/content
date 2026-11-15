
import { NextResponse, connection } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

function istDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

export async function GET() {
  await connection();

  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data: channels, error: channelError } = await admin
      .from("youtube_channels")
      .select("channel_id,channel_name")
      .eq("user_id", user.id);

    if (channelError) throw channelError;

    const today = istDate(new Date());
    const yesterday = istDate(
      new Date(Date.now() - 86400000)
    );

    // Previous day's baseline.
    const { data: daily, error: dailyError } = await admin
      .from("channel_daily_snapshots")
      .select(
        "channel_id,snapshot_date,snapshot_time,total_views,subscribers,total_videos"
      )
      .eq("user_id", user.id)
      .eq("snapshot_date", yesterday);

    if (dailyError) throw dailyError;

    // Latest hourly observations.
    const { data: hourly, error: hourlyError } = await admin
      .from("channel_hourly_snapshots")
      .select(
        "channel_id,snapshot_time,total_views,subscribers,total_videos"
      )
      .eq("user_id", user.id)
     .gte(
  "snapshot_time",
  new Date(
    Date.parse(`${today}T00:00:00Z`) -
    330 * 60 * 1000
  ).toISOString()
)
      .order("snapshot_time", { ascending: false });

    if (hourlyError) throw hourlyError;

    const results = (channels ?? []).map((channel) => {
      const previous = (daily ?? []).find(
        (s) => s.channel_id === channel.channel_id
      );

      const current = (hourly ?? []).find(
        (s) => s.channel_id === channel.channel_id
      );

      if (!previous || !current) {
        return {
          channelId: channel.channel_id,
          name: channel.channel_name,
          status: "collecting" as const,
          viewsChange: null,
          subscribersChange: null,
          videosChange: null,
          snapshotTime: current?.snapshot_time ?? null,
        };
      }

      const viewsChange =
        Number(current.total_views) -
        Number(previous.total_views);

      const videosChange =
        Number(current.total_videos) -
        Number(previous.total_videos);

      const subscribersChange =
        current.subscribers == null ||
        previous.subscribers == null
          ? null
          : Number(current.subscribers) -
            Number(previous.subscribers);

      return {
        channelId: channel.channel_id,
        name: channel.channel_name,
        status: "ready" as const,
        viewsChange,
        subscribersChange,
        videosChange,
        snapshotTime: current.snapshot_time,
      };
    });

    const ready = results.filter(
      (channel) => channel.status === "ready"
    );

    const complete =
      results.length > 0 &&
      ready.length === results.length;

    return NextResponse.json({
      today,
      yesterday,
      comparison:
        "Previous daily snapshot to latest hourly snapshot",
      complete,
      readyChannels: ready.length,
      totalChannels: results.length,
      channels: results,
      totals: {
        viewsChange: complete
          ? ready.reduce(
              (sum, c) => sum + (c.viewsChange ?? 0),
              0
            )
          : null,

        subscribersChange:
          complete &&
          ready.every(
            (c) => c.subscribersChange !== null
          )
            ? ready.reduce(
                (sum, c) =>
                  sum + (c.subscribersChange ?? 0),
                0
              )
            : null,

        videosChange: complete
          ? ready.reduce(
              (sum, c) => sum + (c.videosChange ?? 0),
              0
            )
          : null,
      },
    });
  } catch (error) {
    console.error("Snapshot summary failed:", error);

    return NextResponse.json(
      { error: "Unable to load snapshot summary" },
      { status: 500 }
    );
  }
}
