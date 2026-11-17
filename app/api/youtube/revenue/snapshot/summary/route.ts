
import { NextResponse, connection } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

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

    const now = new Date();

    const today = new Date(
      now.getTime() + 330 * 60000
    ).toISOString().slice(0, 10);

    const revenueMonth = now.toISOString().slice(0, 7);

    const { data: channels, error: channelError } =
      await admin
        .from("youtube_channels")
        .select("channel_id,channel_name")
        .eq("user_id", user.id);

    if (channelError) throw channelError;

    const { data: snapshots, error: snapshotError } =
      await admin
        .from("channel_revenue_snapshots")
        .select("channel_id,snapshot_time,revenue_usd")
        .eq("user_id", user.id)
        .eq("snapshot_date", today)
        .eq("revenue_month", revenueMonth)
        .order("snapshot_time", { ascending: true });

    if (snapshotError) throw snapshotError;

    const results = (channels ?? []).map((channel) => {
      const observations = (snapshots ?? []).filter(
        (snapshot) =>
          snapshot.channel_id === channel.channel_id
      );

      const first = observations[0];
      const latest =
        observations[observations.length - 1];

      if (
        observations.length < 2 ||
        !first ||
        !latest ||
        first.snapshot_time === latest.snapshot_time
      ) {
        return {
          channelId: channel.channel_id,
          name: channel.channel_name,
          status: "collecting",
          revenueChangeUSD: null,
          baselineRevenueUSD: first
            ? Number(first.revenue_usd)
            : null,
          latestRevenueUSD: latest
            ? Number(latest.revenue_usd)
            : null,
          updatedAt: latest?.snapshot_time ?? null,
        };
      }

      const baseline = Number(first.revenue_usd);
      const current = Number(latest.revenue_usd);

      return {
        channelId: channel.channel_id,
        name: channel.channel_name,
        status: "ready",
        revenueChangeUSD: Number(
          (current - baseline).toFixed(6)
        ),
        baselineRevenueUSD: baseline,
        latestRevenueUSD: current,
        updatedAt: latest.snapshot_time,
      };
    });

    const ready = results.filter(
      (channel) => channel.status === "ready"
    );

    const complete =
      results.length > 0 &&
      ready.length === results.length;

    const totalRevenueChangeUSD = complete
      ? Number(
          ready.reduce(
            (sum, channel) =>
              sum + (channel.revenueChangeUSD ?? 0),
            0
          ).toFixed(6)
        )
      : null;

    return NextResponse.json({
      today,
      revenueMonth,
      currency: "USD",
      complete,
      readyChannels: ready.length,
      totalChannels: results.length,
      totalRevenueChangeUSD,
      channels: results,
    });

  } catch (error) {
    console.error("Revenue summary failed:", error);

    return NextResponse.json(
      { error: "Unable to load revenue summary" },
      { status: 500 }
    );
  }
}
