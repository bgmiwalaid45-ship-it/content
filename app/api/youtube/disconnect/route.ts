
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    const body = await request.json().catch(() => null);
    const channelId = body?.channelId;

    if (
      typeof channelId !== "string" ||
      !/^UC[A-Za-z0-9_-]{22}$/.test(channelId)
    ) {
      return NextResponse.json(
        { error: "Invalid channel ID" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("youtube_channels")
      .delete()
      .eq("user_id", user.id)
      .eq("channel_id", channelId)
      .select("channel_id");

    if (error) {
      console.error("Disconnect failed:", error.message);

      return NextResponse.json(
        { error: "Unable to disconnect channel" },
        { status: 500 }
      );
    }

    if (!data?.length) {
      return NextResponse.json(
        { error: "Channel not found or permission denied" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      channelId,
    });
  } catch (error) {
    console.error("Disconnect API error:", error);

    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
