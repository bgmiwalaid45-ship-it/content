
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

async function AccountContent() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#090d18] p-6 text-white">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#111a2b] p-8 text-center">
        <div className="text-4xl text-emerald-400">✓</div>

        <h1 className="mt-4 text-2xl font-bold">
          Login successful!
        </h1>

        <p className="mt-3 text-slate-400">
          Welcome to Creator Command Center.
        </p>

        <p className="mt-5 break-all rounded-lg bg-white/5 p-3 text-sm">
          {user.email}
        </p>

        <a
          href="/"
          className="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
        >
          Open Dashboard
        </a>
      </div>
    </main>
  );
}

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#090d18] text-white">
          Loading account...
        </main>
      }
    >
      <AccountContent />
    </Suspense>
  );
}
