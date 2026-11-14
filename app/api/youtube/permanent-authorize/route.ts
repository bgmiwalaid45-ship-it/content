import { NextRequest, NextResponse, connection } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export async function GET(request: NextRequest) {
  await connection();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  function fail(reason: string) {
    const base = siteUrl || request.nextUrl.origin;

    return NextResponse.redirect(
      new URL(
        `/connect/result?status=${encodeURIComponent(reason)}`,
        base
      )
    );
  }

  try {
    const token = request.nextUrl.searchParams.get("token");

    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      return fail("invalid_link");
    }

    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex");

    const admin = getAdmin();

    const { data: link, error: linkError } = await admin
      .from("youtube_permanent_links")
      .select("id, owner_user_id, is_active")
      .eq("token_hash", tokenHash)
      .eq("is_active", true)
      .maybeSingle();

    if (linkError || !link) {
      return fail("invalid_link");
    }

    // Every use creates a fresh 15-minute request.
    const invitationToken = randomBytes(32).toString("hex");

    const invitationHash = createHash("sha256")
      .update(invitationToken)
      .digest("hex");

    const expiresAt = new Date(
      Date.now() + 15 * 60 * 1000
    ).toISOString();

    const { error: insertError } = await admin
      .from("youtube_connection_requests")
      .insert({
        owner_user_id: link.owner_user_id,
        permanent_link_id: link.id,
        token_hash: invitationHash,
        status: "pending",
        expires_at: expiresAt,
      });

    if (insertError) {
      console.error("Connection request creation failed:", insertError);
      return fail("connection_failed");
    }

    const base = siteUrl || request.nextUrl.origin;

    return NextResponse.redirect(
      new URL(
        `/api/youtube/link-authorize?token=${invitationToken}`,
        base
      )
    );
  } catch (error) {
    console.error("Permanent authorization failed:", error);
    return fail("connection_failed");
  }
}

