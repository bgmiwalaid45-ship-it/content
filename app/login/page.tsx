
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function signInWithGoogle() {
    setLoading(true);
    setError("");

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#090d18] p-6 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111a2b] p-8 text-center shadow-2xl">
        <h1 className="text-2xl font-bold">
          Creator <span className="text-blue-400">Command Center</span>
        </h1>

        <p className="mt-3 text-sm text-slate-400">
          Sign in to manage your YouTube channels in one place.
        </p>

        <button
          onClick={signInWithGoogle}
          disabled={loading}
          className="mt-8 w-full rounded-xl bg-white px-5 py-3 font-semibold text-gray-900 hover:bg-gray-200 disabled:opacity-50"
        >
          {loading ? "Connecting..." : "Continue with Google"}
        </button>

        {error && (
          <p className="mt-4 text-sm text-red-400">{error}</p>
        )}

        <p className="mt-6 text-xs text-slate-500">
          Secure sign-in powered by Supabase.
        </p>
      </div>
    </main>
  );
}
