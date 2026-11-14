
import { NextRequest, NextResponse, connection } from "next/server";
import { google } from "googleapis";
import { createCipheriv, randomBytes, timingSafeEqual } from "node:crypto";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

function encryptToken(token: string): string {
  const keyHex = process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY;

  if (!keyHex || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error("Invalid encryption key");
  }

  const key = Buffer.from(keyHex, "hex");
  const iv = randomBytes(12);

  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);

  return [
    iv.toString("hex"),
    cipher.getAuthTag().toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

export async function GET(request: NextRequest) {
  await connection();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const redirect = (status: string) => {
    const response = NextResponse.redirect(
      new URL(`/account?youtube=${status}`, siteUrl)
    );

    response.cookies.set("youtube_oauth_state", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/youtube/callback",
      maxAge: 0,
    });

    return response;
  };

  try {
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const savedState =
      request.cookies.get("youtube_oauth_state")?.value;

    if (!code || !state || !savedState) {
      return redirect("invalid_state");
    }

    const provided = Buffer.from(state);
    const expected = Buffer.from(savedState);

    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      return redirect("invalid_state");
    }

    // Verify the signed-in user
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return redirect("login_required");
    }

    // Exchange Google authorization code
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_YOUTUBE_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);

    if (!tokens.refresh_token) {
      return redirect("refresh_token_missing");
    }

    // Fetch the authorized YouTube channel
    const youtube = google.youtube({
      version: "v3",
      auth: oauth2Client,
    });

    const response = await youtube.channels.list({
      part: ["snippet"],
      mine: true,
    });

    const channel = response.data.items?.[0];

    if (!channel?.id) {
      return redirect("no_channel");
    }

    // Encrypt refresh token
    const encryptedToken = encryptToken(
      tokens.refresh_token
    );

    // Server-only Supabase admin client
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

    // Save the channel under the authenticated user
    const { error: databaseError } = await admin
      .from("youtube_channels")
      .upsert(
        {
          user_id: user.id,
          channel_id: channel.id,
          channel_name:
            channel.snippet?.title || "YouTube Channel",
          channel_thumbnail:
            channel.snippet?.thumbnails?.default?.url || null,
          encrypted_refresh_token: encryptedToken,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,channel_id",
        }
      );

    if (databaseError) {
      console.error(
        "YouTube channel database error:",
        databaseError.message
      );

      return redirect("database_error");
    }

    console.log("YouTube channel connected:", {
      channelId: channel.id,
      channelName: channel.snippet?.title,
    });

    return redirect("connected");
  } catch (error) {
    console.error(
      "YouTube connection failed:",
      error instanceof Error
        ? error.message
        : "Unknown error"
    );

    return redirect("failed");
  }
}

