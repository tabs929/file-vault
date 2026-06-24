"use client";

import { useEffect, useState } from "react";
import { getHealth } from "@/lib/api";

type ApiStatus = "loading" | "ok" | "error";

export default function HomePage() {
  const [status, setStatus] = useState<ApiStatus>("loading");

  useEffect(() => {
    getHealth()
      .then(() => setStatus("ok"))
      .catch(() => setStatus("error"));
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">
          File Vault
        </h1>
        <p className="mt-2 text-sm text-gray-500">Phase 1 — Foundation</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white px-8 py-6 shadow-sm">
        <p className="text-base text-gray-700">
          API Status:{" "}
          {status === "loading" && (
            <span className="font-semibold text-yellow-600">checking…</span>
          )}
          {status === "ok" && (
            <span className="font-semibold text-green-600">ok</span>
          )}
          {status === "error" && (
            <span className="font-semibold text-red-600">error</span>
          )}
        </p>
      </div>
    </main>
  );
}
