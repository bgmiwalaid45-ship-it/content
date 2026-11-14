
import { NextResponse, connection } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createDecipheriv } from "node:crypto";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";

function decryptToken(value: string): string {
  const keyHex = process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY;

  if (!keyHex || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error("Invalid encryption configuration");
  }

  const parts = value.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token");
  }

  const [ivHex, tagHex, encryptedHex] = parts;
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(keyHex, "hex"),
    Buffer.from(ivHex, "hex")
  );

  decipher.setAuthTag(Buffer.from(tagHex, "hex"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

export async function GET() {
  await connection();
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
      return NextResponse.json(
        { error: "Unable to load channels" },
        { status: 500 }
      );
    }

    // Previous calendar month, in UTC
    const now = new Date();
    const firstOfThisMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    );

    const firstOfLastMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
    );

    const formatDate = (date: Date) =>
      date.toISOString().slice(0, 10);

    const startDate = formatDate(firstOfLastMonth);
    const endDate = formatDate(
      new Date(firstOfThisMonth.getTime() - 86400000)
    );

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
            metrics: "estimatedRevenue",
            currency: "USD",
          });

          const revenue = response.data.rows?.[0]?.[0];

          return {
            channelId: channel.channel_id,
            name: channel.channel_name,
            revenueUSD:
              typeof revenue === "number" ? revenue : 0,
            status: "success",
          };
        } catch {
          return {
            channelId: channel.channel_id,
            name: channel.channel_name,
            revenueUSD: null,
            status: "unavailable",
          };
        }
      })
    );

    const totalRevenueUSD = results.reduce(
      (sum, channel) =>
        sum + (channel.revenueUSD ?? 0),
      0
    );

    return NextResponse.json({
      period: {
        startDate,
        endDate,
        currency: "USD",
      },
      channels: results,
      totalRevenueUSD,
      complete: results.every(
        (channel) => channel.status === "success"
      ),
    });
  } catch (error) {
    console.error(
      "Revenue API error:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      { error: "Unable to load revenue" },
      { status: 500 }
    );
  }
}

