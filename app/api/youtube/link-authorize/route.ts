import { createHash, createHmac, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { connection } from "next/server";

export async function GET(request: NextRequest) {
  await connection();

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;

  const fail = (reason: string) =>
    NextResponse.redirect(
      new URL(
        `/connect/error?reason=${encodeURIComponent(reason)}`,
        siteUrl
      )
    );

  try {
    const token = request.nextUrl.searchParams.get("token");

    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      return fail("invalid_link");
    }

    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex");

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data: invitation, error } = await admin
      .from("youtube_connection_requests")
      .select(
        "id, status, expires_at, permanent_link_id, owner_user_id"
      )
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (error || !invitation) {
      return fail("invalid_link");
    }

    if (
      invitation.status !== "pending" ||
      new Date(invitation.expires_at).getTime() <= Date.now()
    ) {
      return fail("expired_link");
    }

    // Normal one-time links have no permanent_link_id.
    // Only permanent-link requests need this additional check.
    if (invitation.permanent_link_id) {
      const { data: permanentLink, error: linkError } =
        await admin
          .from("youtube_permanent_links")
          .select("id, is_active")
          .eq("id", invitation.permanent_link_id)
          .eq("owner_user_id", invitation.owner_user_id)
          .eq("is_active", true)
          .maybeSingle();

      if (linkError || !permanentLink) {
        return fail("revoked_link");
      }
    }

    const state = randomBytes(32).toString("hex");

    const oauth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${siteUrl}/api/youtube/link-callback`
    );

    const googleUrl = oauth.generateAuthUrl({
      access_type: "offline",
      prompt: "consent select_account",
      scope: [
        "https://www.googleapis.com/auth/youtube.readonly",
        "https://www.googleapis.com/auth/yt-analytics.readonly",
        "https://www.googleapis.com/auth/yt-analytics-monetary.readonly",
      ],
      state,
    });

    const secret = process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY;

    if (!secret) {
      throw new Error("Missing encryption key");
    }

    const payload = JSON.stringify({
      state,
      invitationId: invitation.id,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    const encoded = Buffer.from(payload).toString("base64url");

    const signature = createHmac("sha256", secret)
      .update(encoded)
      .digest("hex");

    const response = NextResponse.redirect(googleUrl);

    response.cookies.set(
      "youtube_link_oauth",
      `${encoded}.${signature}`,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/api/youtube/link-callback",
        maxAge: 15 * 60,
      }
    );

    return response;
  } catch (error) {
    console.error("Link authorization failed:", error);
    return fail("authorization_failed");
  }
}
