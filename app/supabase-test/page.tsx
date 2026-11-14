
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SupabaseTest() {
  const [status, setStatus] = useState("Checking connection...");

  useEffect(() => {
    async function testConnection() {
      try {
        const supabase = createClient();

        const { data, error } = await supabase
          .from("app_connection_test")
          .select("id")
          .limit(1);

        if (error) {
          setStatus("Connection error: " + error.message);
          return;
        }

        setStatus(
          data?.length
            ? "Supabase connected successfully!"
            : "Connected, but no test row found."
        );
      } catch (error) {
        setStatus(
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    }

    testConnection();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-8 text-center">
        <h1 className="text-2xl font-bold">Creator Command Center</h1>
        <p className="mt-4 text-slate-300">{status}</p>
      </div>
    </main>
  );
}
