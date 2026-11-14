
"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ConnectionResult() {
  const params = useSearchParams();
  const success = params.get("status") === "connected";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-8 text-center">
        <div className="text-5xl">{success ? "✅" : "❌"}</div>

        <h1 className="mt-5 text-2xl font-bold">
          {success ? "Channel Connected!" : "Connection Failed"}
        </h1>

        <p className="mt-4 text-sm text-slate-300">
          {success
            ? "Your YouTube channel has been added to the invited workspace. You can close this page."
            : "The connection could not be completed. Please request a new invitation link and try again."}
        </p>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <ConnectionResult />
    </Suspense>
  );
}
