
import { NextRequest, NextResponse, connection } from "next/server";
import { google } from "googleapis";
import {
  createCipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { createClient } from "@supabase/supabase-js";

type OAuthCookie = {
  state: string;
  invitationId: string;
  expiresAt: number;
};

function encryptToken(token: string): string {
  const keyHex = process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY;

  if (!keyHex || !/^[a-f0-9]{64}$/i.test(keyHex)) {
    throw new Error("Invalid token encryption key");
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

function verifyOAuthCookie(
  cookie: string
): OAuthCookie | null {
  try {
    const parts = cookie.split(".");

    if (parts.length !== 2) return null;

    const [encoded, signature] = parts;

    if (!encoded || !/^[a-f0-9]{64}$/i.test(signature)) {
      return null;
    }

    const secret = process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY;

    if (!secret || !/^[a-f0-9]{64}$/i.test(secret)) {
      return null;
    }

    const expectedSignature = createHmac("sha256", secret)
      .update(encoded)
      .digest();

    const providedSignature = Buffer.from(signature, "hex");

    if (
      providedSignature.length !== expectedSignature.length ||
      !timingSafeEqual(
        providedSignature,
        expectedSignature
      )
    ) {
      return null;
    }

    const saved = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as OAuthCookie;

    if (
      typeof saved.state !== "string" ||
      !/^[a-f0-9]{64}$/.test(saved.state) ||
      typeof saved.invitationId !== "string" ||
      !/^[a-f0-9-]{36}$/i.test(saved.invitationId) ||
      typeof saved.expiresAt !== "number" ||
      saved.expiresAt <= Date.now()
    ) {
      return null;
    }

    return saved;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  await connection();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    request.nextUrl.origin;

  const redirect = (status: string) => {
    const response = NextResponse.redirect(
      new URL(
        `/connect/result?status=${encodeURIComponent(status)}`,
        siteUrl
      )
    );

    response.cookies.set("youtube_link_oauth", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/youtube/link-callback",
      maxAge: 0,
    });

    return response;
  };

  try {
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");

    const savedCookie =
      request.cookies.get("youtube_link_oauth")?.value;

    if (!code || !state || !savedCookie) {
      return redirect("invalid_state");
    }

    const saved = verifyOAuthCookie(savedCookie);

    if (!saved) {
      return redirect("invalid_state");
    }

    const providedState = Buffer.from(state);
    const expectedState = Buffer.from(saved.state);

    if (
      providedState.length !== expectedState.length ||
      !timingSafeEqual(providedState, expectedState)
    ) {
      return redirect("invalid_state");
    }

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

    const { data: invitation, error: invitationError } =
      await admin
        .from("youtube_connection_requests")
        .select("id, status, expires_at")
        .eq("id", saved.invitationId)
        .single();

    if (
      invitationError ||
      !invitation ||
      invitation.status !== "pending" ||
      new Date(invitation.expires_at).getTime() <= Date.now()
    ) {
      return redirect("expired_link");
    }

    const oauth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${siteUrl}/api/youtube/link-callback`
    );

    const { tokens } = await oauth.getToken(code);

    oauth.setCredentials(tokens);

    if (!tokens.refresh_token) {
      return redirect("refresh_token_missing");
    }

    const youtube = google.youtube({
      version: "v3",
      auth: oauth,
    });

    const channelResponse = await youtube.channels.list({
      part: ["snippet"],
      mine: true,
    });

    const channel = channelResponse.data.items?.[0];

    if (!channel?.id) {
      return redirect("no_channel");
    }

    const confirmationToken = randomBytes(32).toString("hex");

    const confirmationTokenHash = createHash("sha256")
      .update(confirmationToken)
      .digest("hex");

    const encryptedToken = encryptToken(
      tokens.refresh_token
    );

    const { data: staged, error: stagingError } =
      await admin.rpc("stage_youtube_connection", {
        p_request_id: invitation.id,
        p_channel_id: channel.id,
        p_channel_name:
          channel.snippet?.title || "YouTube Channel",
        p_channel_thumbnail:
          channel.snippet?.thumbnails?.default?.url || null,
        p_encrypted_refresh_token: encryptedToken,
        p_confirmation_token_hash: confirmationTokenHash,
      });

    if (stagingError || staged !== true) {
      console.error(
        "Channel staging failed:",
        stagingError?.message || "Request not staged"
      );

      return redirect("connection_failed");
    }

    const response = NextResponse.redirect(
      new URL("/connect/confirm", siteUrl)
    );

    response.cookies.set(
      "youtube_link_confirmation",
      confirmationToken,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 15 * 60,
      }
    );

    response.cookies.set("youtube_link_oauth", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/youtube/link-callback",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error(
      "YouTube link callback failed:",
      error instanceof Error
        ? error.message
        : "Unknown error"
    );

    return redirect("failed");
  }
}

