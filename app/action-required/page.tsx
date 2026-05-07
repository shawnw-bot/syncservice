// app/action-required/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SyncItem = {
  external_id: string;
  status: string;
  received_at?: string;
  action_required_at?: string;
  action_required_reason?: string;
};

type AccessInfo = {
  tier: string;
  status: string;
};

type OkResult = { type: "ok"; items: SyncItem[]; access?: AccessInfo };
type DeniedResult = { type: "denied" };
type ErrorResult = { type: "error"; message: string };

type FetchResult = OkResult | DeniedResult | ErrorResult;

async function fetchActionRequiredSyncs(): Promise<FetchResult> {
  try {
    const res = await fetch("/api/sync?status=ACTION_REQUIRED&limit=25", {
      cache: "no-store",
    });

    if (res.status === 401 || res.status === 403) {
      return { type: "denied" };
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const msg =
        data?.message ||
        data?.errorMessage ||
        `Failed to fetch (HTTP ${res.status})`;
      return { type: "error", message: msg };
    }

    const data = await res.json().catch(() => ({}));
    return {
      type: "ok",
      items: data.items ?? [],
      access: data.access,
    };
  } catch (e: any) {
    return {
      type: "error",
      message: e?.message ?? "Network error while loading queue.",
    };
  }
}

export default function ActionRequiredPage() {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<FetchResult>({
    type: "ok",
    items: [],
  });

  async function load() {
    setLoading(true);
    const r = await fetchActionRequiredSyncs();
    setResult(r);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ============================================================
     Shared page header
  ============================================================ */
  function PageHeader() {
    return (
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Action Required
        </h1>
        <p className="text-sm text-gray-600">
          Syncs that require an operator decision or follow‑up.
        </p>
      </div>
    );
  }

  /* ============================================================
     Loading
  ============================================================ */
  if (loading) {
    return (
      <section className="space-y-6">
        <PageHeader />
        <div className="rounded-lg border bg-gray-50 p-6 text-gray-500">
          Loading Action Required queue…
        </div>
      </section>
    );
  }

  /* ============================================================
     Access denied
  ============================================================ */
  if (result.type === "denied") {
    return (
      <section className="space-y-6">
        <PageHeader />

        <div className="rounded-lg border bg-gray-50 p-6 space-y-4 max-w-xl">
          <h2 className="text-lg font-medium">
            Upgrade Required
          </h2>

          <p className="text-sm text-gray-600">
            Viewing and managing service workflows requires an active
            subscription. Upgrade your plan to unlock full visibility.
          </p>

          <div className="flex gap-3 pt-2">
            <button
              disabled
              className="px-4 py-2 rounded bg-blue-600 text-white text-sm opacity-70"
            >
              View Plans
            </button>
            <button
              disabled
              className="px-4 py-2 rounded border text-sm text-gray-700 opacity-70"
            >
              Contact Sales
            </button>
          </div>

          <div className="pt-2">
            <Link
              href="/sync"
              className="text-sm text-blue-700 hover:underline"
            >
              ← Back to Sync
            </Link>
          </div>
        </div>
      </section>
    );
  }

  /* ============================================================
     Error
  ============================================================ */
  if (result.type === "error") {
    return (
      <section className="space-y-6">
        <PageHeader />

        <div className="rounded-lg border bg-red-50 p-6 space-y-3 max-w-xl">
          <h2 className="text-lg font-medium text-red-800">
            Unable to load queue
          </h2>

          <p className="text-sm text-red-700">
            {result.message}
          </p>

          <div className="flex gap-3 pt-2">
            <button
              onClick={load}
              className="px-4 py-2 rounded bg-black text-white text-sm hover:bg-gray-800"
            >
              Retry
            </button>

            <Link
              href="/sync"
              className="px-4 py-2 rounded border text-sm text-gray-700 hover:bg-white"
            >
              Back to Sync
            </Link>
          </div>
        </div>
      </section>
    );
  }

  /* ============================================================
     OK state
  ============================================================ */
  const syncs = result.items;
  const access = result.access;

  return (
    <section className="space-y-6">
      <PageHeader />

      {access && (
        <div className="text-sm text-gray-600">
          Plan:{" "}
          <span className="font-medium capitalize">
            {access.tier}
          </span>{" "}
          • Status:{" "}
          <span className="font-medium text-green-700 capitalize">
            {access.status}
          </span>
        </div>
      )}

      {syncs.length === 0 ? (
        <div className="rounded-lg border bg-gray-50 p-6 space-y-3 max-w-xl">
          <div className="font-medium">
            ✅ Queue clear
          </div>

          <p className="text-sm text-gray-600">
            There are currently no Syncs that require action.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/sync"
              className="text-sm text-blue-700 hover:underline"
            >
              Go to Sync list →
            </Link>
            <Link
              href="/manager/completed"
              className="text-sm text-blue-700 hover:underline"
            >
              View Completed ROs →
            </Link>
          </div>

          <button
            onClick={load}
            className="mt-2 inline-flex px-4 py-2 rounded border text-sm text-gray-800 hover:bg-white w-fit"
          >
            Refresh queue
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {syncs.map((sync) => (
            <li key={sync.external_id}>
              <Link
                href={`/sync/${sync.external_id}`}
                className="block rounded-lg border bg-yellow-50 p-4 hover:bg-yellow-100 transition"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <div className="font-medium text-yellow-900">
                      {sync.external_id}
                    </div>

                    {sync.action_required_reason && (
                      <div className="text-sm text-gray-700">
                        {sync.action_required_reason}
                      </div>
                    )}

                    {sync.action_required_at && (
                      <div className="text-xs text-gray-500">
                        Action required at{" "}
                        {new Date(
                          sync.action_required_at
                        ).toLocaleString()}
                      </div>
                    )}
                  </div>

                  <div className="text-sm font-medium text-blue-700">
                    Open →
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}