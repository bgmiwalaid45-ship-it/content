
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
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

    const { data: channels, error: dbError } = await supabase
      .from("youtube_channels")
      .select("channel_id, channel_name, channel_thumbnail")
      .eq("user_id", user.id);

    if (dbError) {
      return NextResponse.json(
        { error: "Database error" },
        { status: 500 }
      );
    }

    const youtube = google.youtube({
      version: "v3",
      auth: process.env.GOOGLE_YOUTUBE_API_KEY,
    });

    const results = await Promise.all(
      (channels || []).map(async (channel) => {
        try {
          if (!process.env.GOOGLE_YOUTUBE_API_KEY) {
            throw new Error("Missing YouTube API key");
          }

          const response = await youtube.channels.list({
            part: ["statistics", "snippet"],
            id: [channel.channel_id],
          });

          const details = response.data.items?.[0];

          return {
            channelId: channel.channel_id,
            name: details?.snippet?.title || channel.channel_name,
            thumbnail:
              details?.snippet?.thumbnails?.default?.url ||
              channel.channel_thumbnail,
            subscribers: details?.statistics?.subscriberCount ?? null,
            totalViews: details?.statistics?.viewCount ?? null,
            totalVideos: details?.statistics?.videoCount ?? null,
          };
        } catch {
          return {
            channelId: channel.channel_id,
            name: channel.channel_name,
            thumbnail: channel.channel_thumbnail,
            subscribers: null,
            totalViews: null,
            totalVideos: null,
          };
        }
      })
    );

    return NextResponse.json({ channels: results });
  } catch {
    return NextResponse.json(
      { error: "Failed to load channels" },
      { status: 500 }
    );
  }
}
