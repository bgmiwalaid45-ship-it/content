
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createDecipheriv } from "node:crypto";
import { google } from "googleapis";

export const maxDuration = 60;

function decryptToken(value: string): string {
  const keyHex = process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY;

  if (!keyHex || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error("Invalid encryption configuration");
  }

  const [iv, tag, encrypted] = value.split(":");

  if (!iv || !tag || !encrypted) {
    throw new Error("Invalid encrypted token");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(keyHex, "hex"),
    Buffer.from(iv, "hex")
  );

  decipher.setAuthTag(Buffer.from(tag, "hex"));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

function istDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET missing" },
      { status: 500 }
    );
  }

  if (
    request.headers.get("authorization") !==
    `Bearer ${secret}`
  ) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data: channels, error: channelError } =
      await supabase
        .from("youtube_channels")
        .select(
          "user_id,channel_id,encrypted_refresh_token"
        );

    if (channelError) throw channelError;

    const now = new Date();
    const snapshotDate = istDate(now);
    const revenueMonth = now.toISOString().slice(0, 7);

    const startDate = `${revenueMonth}-01`;

    const endDate = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - 1
      )
    ).toISOString().slice(0, 10);

    if (endDate < startDate) {
      return NextResponse.json({
        status: "pending",
        reason: "No completed day in current UTC month",
      });
    }

    const results = [];

    for (const channel of channels ?? []) {
      try {
        const refreshToken = decryptToken(
          channel.encrypted_refresh_token
        );

        const auth = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_YOUTUBE_REDIRECT_URI
        );

        auth.setCredentials({
          refresh_token: refreshToken,
        });

        const analytics = google.youtubeAnalytics({
          version: "v2",
          auth,
        });

        const response = await analytics.reports.query({
          ids: `channel==${channel.channel_id}`,
          startDate,
          endDate,
          metrics: "estimatedRevenue",
          currency: "USD",
        });

        const value = response.data.rows?.[0]?.[0];

        // Never save missing revenue as zero.
        if (
          typeof value !== "number" ||
          !Number.isFinite(value)
        ) {
          results.push({
            channelId: channel.channel_id,
            status: "unavailable",
          });

          continue;
        }

        const { error: insertError } = await supabase
          .from("channel_revenue_snapshots")
          .insert({
            user_id: channel.user_id,
            channel_id: channel.channel_id,
            snapshot_date: snapshotDate,
            snapshot_time: new Date().toISOString(),
            revenue_month: revenueMonth,
            revenue_usd: value,
          });

        if (insertError) throw insertError;

        results.push({
          channelId: channel.channel_id,
          status: "saved",
        });
      } catch (error) {
        console.error(
          "Revenue snapshot failed:",
          channel.channel_id,
          error instanceof Error
            ? error.message
            : "Unknown error"
        );

        results.push({
          channelId: channel.channel_id,
          status: "failed",
        });
      }
    }

    const saved = results.filter(
      (item) => item.status === "saved"
    ).length;

    return NextResponse.json({
      date: snapshotDate,
      revenueMonth,
      startDate,
      endDate,
      checked: results.length,
      saved,
      failed: results.filter(
        (item) => item.status === "failed"
      ).length,
      unavailable: results.filter(
        (item) => item.status === "unavailable"
      ).length,
      complete: saved === results.length,
      results,
    });
  } catch (error) {
    console.error("Revenue snapshot error:", error);

    return NextResponse.json(
      { error: "Revenue snapshot collection failed" },
      { status: 500 }
    );
  }
}
