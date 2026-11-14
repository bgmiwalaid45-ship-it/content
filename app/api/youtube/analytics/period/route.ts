
import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createDecipheriv } from "node:crypto";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";

type DailyRow = {
  date: string;
  views: number;
  revenueUSD: number;
  subscribersGained: number;
  subscribersLost: number;
};

type Period = "today" | "yesterday" | "7" | "28" | "month" | "total";

function decryptToken(value: string): string {
  const keyHex = process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY;

  if (!keyHex || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error("Invalid encryption key");
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

function dateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getDates(period: Period) {
  const now = new Date();

  // Use IST calendar dates
  const istToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const today = new Date(`${istToday}T00:00:00Z`);

  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  let start = new Date(yesterday);
  let end = new Date(yesterday);

  if (period === "today") {
    start = new Date(today);
    end = new Date(today);
  } else if (period === "7") {
    start.setUTCDate(start.getUTCDate() - 6);
  } else if (period === "28") {
    start.setUTCDate(start.getUTCDate() - 27);
  } else if (period === "month") {
    start = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)
    );
  } else if (period === "total") {
    // Analytics historical range.
    // Lifetime channel totals should come from the Data API.
    start = new Date("2005-01-01T00:00:00Z");
  }

  return {
    startDate: dateString(start),
    endDate: dateString(end),
  };
}

export async function GET(request: NextRequest) {
  try {
    const input = request.nextUrl.searchParams.get("period") || "28";

    const allowed: Period[] = [
      "today",
      "yesterday",
      "7",
      "28",
      "month",
      "total",
    ];

    if (!allowed.includes(input as Period)) {
      return NextResponse.json(
        { error: "Invalid period" },
        { status: 400 }
      );
    }

    const period = input as Period;

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
      .select(
        "channel_id,channel_name,encrypted_refresh_token"
      )
      .eq("user_id", user.id);

    if (dbError) {
      throw new Error("Unable to load connected channels");
    }

    const { startDate, endDate } = getDates(period);

    // YouTube Analytics is generally delayed.
    // Never report current-day earnings as confirmed zero.
    if (period === "today") {
      return NextResponse.json({
        period: {
          startDate,
          endDate,
          currency: "USD",
        },
        channels: (channels || []).map((channel) => ({
          channelId: channel.channel_id,
          name: channel.channel_name,
          status: "pending",
          daily: [],
          totalViews: null,
          totalRevenueUSD: null,
          subscribersGained: null,
          subscribersLost: null,
          netSubscribers: null,
        })),
        totalViews: null,
        totalRevenueUSD: null,
        subscribersGained: null,
        subscribersLost: null,
        netSubscribers: null,
        complete: false,
      });
    }

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
            metrics:
              "views,estimatedRevenue,subscribersGained,subscribersLost",
            dimensions: "day",
            sort: "day",
            currency: "USD",
          });

          const daily: DailyRow[] = (
            response.data.rows || []
          ).map((row) => ({
            date: String(row[0]),
            views: Number(row[1] || 0),
            revenueUSD: Number(row[2] || 0),
            subscribersGained: Number(row[3] || 0),
            subscribersLost: Number(row[4] || 0),
          }));

          const totalViews = daily.reduce(
            (sum, row) => sum + row.views,
            0
          );

          const totalRevenueUSD = daily.reduce(
            (sum, row) => sum + row.revenueUSD,
            0
          );

          const subscribersGained = daily.reduce(
            (sum, row) => sum + row.subscribersGained,
            0
          );

          const subscribersLost = daily.reduce(
            (sum, row) => sum + row.subscribersLost,
            0
          );

          return {
            channelId: channel.channel_id,
            name: channel.channel_name,
            status: "success",
            daily,
            totalViews,
            totalRevenueUSD,
            subscribersGained,
            subscribersLost,
            netSubscribers: subscribersGained - subscribersLost,
          };
        } catch (error) {
          console.error(
            "Period analytics error:",
            channel.channel_id,
            error instanceof Error
              ? error.message
              : "Unknown error"
          );

          return {
            channelId: channel.channel_id,
            name: channel.channel_name,
            status: "unavailable",
            daily: [] as DailyRow[],
            totalViews: null,
            totalRevenueUSD: null,
            subscribersGained: null,
            subscribersLost: null,
            netSubscribers: null,
          };
        }
      })
    );

    const complete = results.every(
      (channel) => channel.status === "success"
    );

    const sumMetric = (
      key:
        | "totalViews"
        | "totalRevenueUSD"
        | "subscribersGained"
        | "subscribersLost"
        | "netSubscribers"
    ) => {
      if (!complete) return null;

      return results.reduce(
        (sum, channel) => sum + (channel[key] ?? 0),
        0
      );
    };

    return NextResponse.json({
      period: {
        startDate,
        endDate,
        currency: "USD",
      },
      channels: results,
      totalViews: sumMetric("totalViews"),
      totalRevenueUSD: sumMetric("totalRevenueUSD"),
      subscribersGained: sumMetric("subscribersGained"),
      subscribersLost: sumMetric("subscribersLost"),
      netSubscribers: sumMetric("netSubscribers"),
      complete,
    });
  } catch (error) {
    console.error(
      "Period API error:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      { error: "Unable to load period analytics" },
      { status: 500 }
    );
  }
}
