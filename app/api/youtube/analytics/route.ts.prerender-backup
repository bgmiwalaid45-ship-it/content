
import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createDecipheriv } from "node:crypto";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";

function decryptToken(value: string): string {
  const keyHex = process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY;

  if (!keyHex || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error("Invalid encryption key");
  }

  const [iv, tag, encrypted] = value.split(":");

  if (!iv || !tag || !encrypted) {
    throw new Error("Invalid token format");
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

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
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

    const { data: channels, error: dbError } = await admin
      .from("youtube_channels")
      .select("channel_id, channel_name, encrypted_refresh_token")
      .eq("user_id", user.id);

    if (dbError) {
      throw new Error("Database query failed");
    }

    // Last 28 completed days (UTC)
    const now = new Date();

    const end = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - 1
      )
    );

    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 27);

    const startDate = start.toISOString().slice(0, 10);
    const endDate = end.toISOString().slice(0, 10);

    const results = await Promise.all(
      (channels || []).map(async (channel) => {
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
            metrics: "views,estimatedRevenue",
            dimensions: "day",
            sort: "day",
            currency: "USD",
          });

          const rows = (response.data.rows || []).map((row) => ({
            date: String(row[0]),
            views: Number(row[1] || 0),
            revenueUSD: Number(row[2] || 0),
          }));

          return {
            channelId: channel.channel_id,
            name: channel.channel_name,
            status: "success",
            daily: rows,
            totalViews: rows.reduce(
              (sum, row) => sum + row.views,
              0
            ),
            totalRevenueUSD: rows.reduce(
              (sum, row) => sum + row.revenueUSD,
              0
            ),
          };
        } catch (error) {
          console.error(
            "Analytics failed for channel:",
            channel.channel_id,
            error instanceof Error ? error.message : "Unknown error"
          );

          return {
            channelId: channel.channel_id,
            name: channel.channel_name,
            status: "unavailable",
            daily: [],
            totalViews: null,
            totalRevenueUSD: null,
          };
        }
      })
    );

    return NextResponse.json({
      period: {
        startDate,
        endDate,
        currency: "USD",
      },
      channels: results,
      complete: results.every(
        (channel) => channel.status === "success"
      ),
    });
  } catch (error) {
    console.error(
      "Analytics API error:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      { error: "Unable to load analytics" },
      { status: 500 }
    );
  }
}
