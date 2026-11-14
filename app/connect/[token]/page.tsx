
"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";

function ConnectChannelContent() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const handleConnect = () => {
    if (!token) return;

    window.location.href =
      `/api/youtube/link-authorize?token=${encodeURIComponent(token)}`;
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-8 text-center">
        <div className="mb-4 text-4xl">▶️</div>

        <h1 className="text-2xl font-bold">
          Connect YouTube Channel
        </h1>

        <p className="mt-4 text-sm text-slate-300">
          You have been invited to connect your YouTube channel
          to a Creator Command Center workspace.
        </p>

        <p className="mt-3 text-xs text-amber-300">
          Continue only if you trust the person who sent this link.
          They may be able to view your channel analytics and revenue.
        </p>

        <button
          type="button"
          onClick={handleConnect}
          disabled={!token}
          className="mt-7 w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
        >
          Continue with Google
        </button>

        <p className="mt-4 text-xs text-slate-500">
          Google will ask for your permission.
          Never share your password.
          This invitation expires after 15 minutes.
        </p>
      </div>
    </main>
  );
}

export default function ConnectChannelPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
          Loading invitation...
        </main>
      }
    >
      <ConnectChannelContent />
    </Suspense>
  );
}
