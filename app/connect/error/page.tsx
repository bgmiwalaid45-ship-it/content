
"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ConnectionError() {
  const params = useSearchParams();
  const reason = params.get("reason");

  const message =
    reason === "expired_link"
      ? "This invitation has expired or has already been used."
      : reason === "invalid_link"
        ? "This connection link is invalid."
        : "Unable to start Google authorization.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-8 text-center">
        <div className="text-5xl">⚠️</div>

        <h1 className="mt-5 text-2xl font-bold">
          Connection Link Error
        </h1>

        <p className="mt-4 text-sm text-slate-300">
          {message}
        </p>

        <p className="mt-5 text-xs text-slate-500">
          Ask the workspace owner to generate a new secure link.
        </p>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <ConnectionError />
    </Suspense>
  );
}

