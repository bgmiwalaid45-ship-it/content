import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

function getAdmin() {
  return createAdminClient(
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

async function getUser() {
  const supabase = await createServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  return user;
}

export async function GET() {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const admin = getAdmin();

    const { data, error } = await admin
      .from("youtube_permanent_links")
      .select("id, name, is_active, created_at")
      .eq("owner_user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      links: data || [],
    });
  } catch (error) {
    console.error("Permanent links lookup failed:", error);

    return NextResponse.json(
      { error: "Unable to load links" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const admin = getAdmin();

    const { count, error: countError } = await admin
      .from("youtube_permanent_links")
      .select("id", { count: "exact", head: true })
      .eq("owner_user_id", user.id)
      .eq("is_active", true);

    if (countError) throw countError;

    if ((count || 0) >= 10) {
      return NextResponse.json(
        { error: "Maximum 10 active links allowed" },
        { status: 429 }
      );
    }

    const token = randomBytes(32).toString("hex");

    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex");

    const { data, error } = await admin
      .from("youtube_permanent_links")
      .insert({
        owner_user_id: user.id,
        token_hash: tokenHash,
        name: "YouTube Connection Link",
      })
      .select("id, name, created_at")
      .single();

    if (error || !data) throw error;

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      request.nextUrl.origin;

    return NextResponse.json({
      success: true,
      id: data.id,
      name: data.name,
      url: `${siteUrl}/connect/p/${token}`,
      createdAt: data.created_at,
    });
  } catch (error) {
    console.error("Permanent link creation failed:", error);

    return NextResponse.json(
      { error: "Unable to generate link" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    if (
      typeof body.id !== "string" ||
      !/^[a-f0-9-]{36}$/i.test(body.id)
    ) {
      return NextResponse.json(
        { error: "Invalid link ID" },
        { status: 400 }
      );
    }

    const admin = getAdmin();

    const { data, error } = await admin
      .from("youtube_permanent_links")
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
      })
      .eq("id", body.id)
      .eq("owner_user_id", user.id)
      .eq("is_active", true)
      .select("id")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Link not found or already revoked" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Permanent link revocation failed:", error);

    return NextResponse.json(
      { error: "Unable to revoke link" },
      { status: 500 }
    );
  }
}
