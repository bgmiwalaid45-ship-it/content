import { NextResponse, connection } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

function istDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export async function GET() {
  await connection();
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: channels, error: channelError } = await admin.from("youtube_channels")
      .select("channel_id,channel_name").eq("user_id", user.id);
    if (channelError) throw channelError;

    const today = istDate(new Date());
    const yesterday = istDate(new Date(Date.now() - 86400000));
    const { data: snapshots, error: snapshotError } = await admin.from("channel_daily_snapshots")
      .select("channel_id,snapshot_date,snapshot_time,total_views,subscribers,total_videos")
      .eq("user_id", user.id).in("snapshot_date", [today, yesterday]);
    if (snapshotError) throw snapshotError;

    const results = (channels || []).map(channel => {
      const entries = (snapshots || []).filter(s => s.channel_id === channel.channel_id);
      const current = entries.find(s => s.snapshot_date === today);
      const previous = entries.find(s => s.snapshot_date === yesterday);
      if (!current || !previous) {
        return { channelId: channel.channel_id, name: channel.channel_name,
          status: "collecting" as const, viewsChange: null, subscribersChange: null,
          videosChange: null, snapshotTime: current?.snapshot_time || null };
      }
      const viewsChange = Number(current.total_views) - Number(previous.total_views);
      const videosChange = Number(current.total_videos) - Number(previous.total_videos);
      const subscribersChange = current.subscribers == null || previous.subscribers == null
        ? null : Number(current.subscribers) - Number(previous.subscribers);
      return { channelId: channel.channel_id, name: channel.channel_name,
        status: "ready" as const, viewsChange, subscribersChange, videosChange,
        snapshotTime: current.snapshot_time };
    });
    const ready = results.filter(c => c.status === "ready");
    return NextResponse.json({
      today, yesterday, comparison: "Previous day's snapshot to today's snapshot (approximately 9 AM IST to 9 AM IST)",
      complete: results.length > 0 && ready.length === results.length,
      readyChannels: ready.length, totalChannels: results.length,
      channels: results,
      totals: {
        viewsChange: ready.reduce((sum, c) => sum + (c.viewsChange || 0), 0),
        subscribersChange: ready.every(c => c.subscribersChange !== null)
          ? ready.reduce((sum, c) => sum + (c.subscribersChange || 0), 0) : null,
        videosChange: ready.reduce((sum, c) => sum + (c.videosChange || 0), 0),
      },
    });
  } catch (error) {
    console.error("Snapshot summary failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Unable to load snapshot summary" }, { status: 500 });
  }
}
