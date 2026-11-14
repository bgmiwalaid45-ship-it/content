
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    // Check request origin
    const origin = request.headers.get("origin");

    if (
      !origin ||
      new URL(origin).origin !== request.nextUrl.origin
    ) {
      return NextResponse.json(
        { error: "Invalid request origin" },
        { status: 403 }
      );
    }

    // Verify logged-in user
    const supabase = await createServerClient();

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

    // Validate selected channel
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

    // Admin client bypasses RLS.
    // Ownership is enforced using user.id.
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

    const { data, error } = await admin
      .from("youtube_channels")
      .delete()
      .eq("user_id", user.id)
      .eq("channel_id", channelId)
      .select("channel_id");

    if (error) {
      console.error("Disconnect failed:", error);

      return NextResponse.json(
        { error: "Unable to disconnect channel" },
        { status: 500 }
      );
    }

    if (!data?.length) {
      return NextResponse.json(
        { error: "Channel not found" },
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
