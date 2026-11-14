
import { NextResponse, connection } from "next/server";
import { google } from "googleapis";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";


export async function GET() {
  await connection();
  try {
    // Verify that the user is logged into our website
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.redirect(
        new URL("/login", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000")
      );
    }

    // Check Google OAuth configuration
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_YOUTUBE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.json(
        { error: "Google OAuth environment variables are missing." },
        { status: 500 }
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // Generate a random state to protect the OAuth flow
    const state = randomBytes(32).toString("hex");

    const authorizationUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: true,
      scope: [
        "https://www.googleapis.com/auth/youtube.readonly",
        "https://www.googleapis.com/auth/yt-analytics.readonly",
        "https://www.googleapis.com/auth/yt-analytics-monetary.readonly",
      ],
      state,
    });

    const response = NextResponse.redirect(authorizationUrl);

    // Store state in a short-lived, HTTP-only cookie
    response.cookies.set("youtube_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/youtube/callback",
      maxAge: 600,
    });

    return response;
  } catch (error) {
    console.error("YouTube OAuth start error:", error);

    return NextResponse.json(
      { error: "Unable to start YouTube authorization." },
      { status: 500 }
    );
  }
}

