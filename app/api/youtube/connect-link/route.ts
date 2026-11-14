
import { NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Please login first" },
        { status: 401 }
      );
    }

    const token = randomBytes(32).toString("hex");

    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex");

    const expiresAt = new Date(
      Date.now() + 15 * 60 * 1000
    ).toISOString();

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

    const { error } = await admin
      .from("youtube_connection_requests")
      .insert({
        owner_user_id: user.id,
        token_hash: tokenHash,
        status: "pending",
        expires_at: expiresAt,
      });

    if (error) {
      console.error("Connection link database error:", error.message);

      return NextResponse.json(
        { error: "Unable to generate link" },
        { status: 500 }
      );
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000";

    const link = new URL(`/connect/${token}`, siteUrl);

    return NextResponse.json({
      link: link.toString(),
      expiresAt,
    });
  } catch (error) {
    console.error("Generate link error:", error);

    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
