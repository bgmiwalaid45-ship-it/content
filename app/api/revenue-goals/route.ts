
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export async function GET() {
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

    const { data, error } = await supabase
      .from("revenue_goals")
      .select("id,month,channel_id,target_usd")
      .eq("user_id", user.id)
      .eq("month", currentMonth());

    if (error) throw error;

    return NextResponse.json({
      month: currentMonth(),
      goals: data ?? [],
    });
  } catch (error) {
    console.error("Revenue goals GET error:", error);

    return NextResponse.json(
      { error: "Unable to load revenue goals" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();

    const target = Number(body.targetUSD);
    const channelId = body.channelId ?? "all";

    if (
      !Number.isFinite(target) ||
      target <= 0 ||
      target > 9999999999.99 ||
      !Number.isInteger(Math.round(target * 100)) ||
      typeof channelId !== "string" ||
      !channelId.trim()
    ) {
      return NextResponse.json(
        { error: "Invalid revenue goal" },
        { status: 400 }
      );
    }

    if (channelId !== "all") {
      const { data: channel, error: channelError } =
        await supabase
          .from("youtube_channels")
          .select("channel_id")
          .eq("user_id", user.id)
          .eq("channel_id", channelId)
          .maybeSingle();

      if (channelError || !channel) {
        return NextResponse.json(
          { error: "Channel not connected" },
          { status: 403 }
        );
      }
    }

    const { data, error } = await supabase
      .from("revenue_goals")
      .upsert(
        {
          user_id: user.id,
          month: currentMonth(),
          channel_id: channelId,
          target_usd: target,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,month,channel_id",
        }
      )
      .select("id,month,channel_id,target_usd")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      goal: data,
    });
  } catch (error) {
    console.error("Revenue goals POST error:", error);

    return NextResponse.json(
      { error: "Unable to save revenue goal" },
      { status: 500 }
    );
  }
}
