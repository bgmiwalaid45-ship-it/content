import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

function getToken(request: NextRequest) {
  const token = request.cookies.get(
    "youtube_link_confirmation"
  )?.value;

  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return null;
  }

  return createHash("sha256")
    .update(token)
    .digest("hex");
}

export async function GET(request: NextRequest) {
  try {
    const tokenHash = getToken(request);

    if (!tokenHash) {
      return NextResponse.json(
        { error: "Invalid or missing confirmation" },
        { status: 401 }
      );
    }

    const admin = getAdmin();

    const { data, error } = await admin
      .from("youtube_connection_requests")
      .select(
        "channel_id, channel_name, channel_thumbnail, expires_at"
      )
      .eq("confirmation_token_hash", tokenHash)
      .eq("status", "authorized")
      .gt("expires_at", new Date().toISOString())
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Confirmation expired or unavailable" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      channelId: data.channel_id,
      channelName: data.channel_name,
      channelThumbnail: data.channel_thumbnail,
      expiresAt: data.expires_at,
    });
  } catch (error) {
    console.error("Confirmation lookup failed:", error);

    return NextResponse.json(
      { error: "Unable to load confirmation" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const tokenHash = getToken(request);

    if (!tokenHash) {
      return NextResponse.json(
        { error: "Invalid or missing confirmation" },
        { status: 401 }
      );
    }

    const admin = getAdmin();

    const { data: completed, error } = await admin.rpc(
      "confirm_youtube_connection",
      {
        p_confirmation_token_hash: tokenHash,
      }
    );

    if (error || completed !== true) {
      return NextResponse.json(
        { error: "Confirmation expired or already used" },
        { status: 409 }
      );
    }

    const response = NextResponse.json({
      success: true,
    });

    response.cookies.set(
      "youtube_link_confirmation",
      "",
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      }
    );

    return response;
  } catch (error) {
    console.error("Channel confirmation failed:", error);

    return NextResponse.json(
      { error: "Unable to confirm connection" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const tokenHash = getToken(request);

    if (!tokenHash) {
      return NextResponse.json(
        { error: "Invalid confirmation" },
        { status: 401 }
      );
    }

    const admin = getAdmin();

    const { data: cancelled, error } = await admin.rpc(
      "cancel_youtube_connection",
      {
        p_confirmation_token_hash: tokenHash,
      }
    );

    if (error || cancelled !== true) {
      return NextResponse.json(
        { error: "Unable to cancel connection" },
        { status: 409 }
      );
    }

    const response = NextResponse.json({
      success: true,
    });

    response.cookies.set(
      "youtube_link_confirmation",
      "",
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      }
    );

    return response;
  } catch (error) {
    console.error("Cancel connection failed:", error);

    return NextResponse.json(
      { error: "Cancellation failed" },
      { status: 500 }
    );
  }
}

