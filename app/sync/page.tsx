// app/sync/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type RawItem = any;

type SyncItem = {
  external_id: string; // guaranteed non-empty after normalization
  status: string;
  action_required_reason?: string;
};

type FilterKey = "ALL" | "ACTION_REQUIRED" | "PROCESSING" | "COMPLETED";

async function fetchSyncs(): Promise<RawItem[]> {
  const res = await fetch("/api/sync", { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  return data.items ?? [];
}

/**
 * Normalize whatever comes back from /api/sync into a stable shape for UI.
 * - Accepts external_id or externalId
 * - If missing, tries to derive from SK like "EXT#<id>"
 * - If still missing, drops the item (not a Sync record)
 */
function normalizeSyncItems(items: RawItem[]): SyncItem[] {
  const normalized: SyncItem[] = [];

  for (const it of items ?? []) {
    const status = it?.status ?? "";
    const externalId =
      it?.external_id ??
      it?.externalId ??
      (typeof it?.SK === "string" && it.SK.startsWith("EXT#")
        ? it.SK.slice(4)
        : null);

    // Drop non-sync records (vehicles, billing records, etc.)
    if (!externalId || typeof externalId !== "string") continue;

    normalized.push({
      external_id: externalId,
      status: String(status || "UNKNOWN"),
      action_required_reason: it?.action_required_reason ?? it?.actionRequiredReason ?? undefined,
    });
  }

  return normalized;
}

function StatusBadge({ status }: { status: string }) {
  let color = "bg-gray-200 text-gray-700";

  if (status === "ACTION_REQUIRED") {
    color = "bg-yellow-100 text-yellow-800";
  } else if (status === "PROCESSING") {
    color = "bg-blue-100 text-blue-800";
  } else if (status === "COMPLETED") {
    color = "bg-green-100 text-green-800";
  }

  return (
    <span className={`inline-block px-2 py-1 text-xs rounded font-medium ${color}`}>
      {status}
    </span>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-white p-4 space-y-1">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

function FilterTab({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors",
        active ? "bg-black text-white border-black" : "bg-white hover:bg-gray-50",
      ].join(" ")}
    >
      <span>{label}</span>
      <span
        className={[
          "inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 text-xs rounded-full",
          active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-700",
        ].join(" ")}
      >
        {count}
      </span>
    </button>
  );
}

export default function SyncPage() {
  const [syncs, setSyncs] = useState<SyncItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("ALL");

  useEffect(() => {
    async function load() {
      try {
        const raw = await fetchSyncs();
        const normalized = normalizeSyncItems(raw);
        setSyncs(normalized);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Counts reflect normalized dataset only (no non-sync records)
  const totalCount = syncs.length;
  const actionRequiredCount = syncs.filter((s) => s.status === "ACTION_REQUIRED").length;
  const processingCount = syncs.filter((s) => s.status === "PROCESSING").length;
  const completedCount = syncs.filter((s) => s.status === "COMPLETED").length;

  const filteredSyncs = useMemo(() => {
    if (filter === "ALL") return syncs;
    return syncs.filter((s) => s.status === filter);
  }, [syncs, filter]);

  // Prioritize Action Required first in ALL view; stable sort by external_id safely
  const displaySyncs = useMemo(() => {
    const list = [...filteredSyncs];

    const priority = (status: string) => {
      if (status === "ACTION_REQUIRED") return 0;
      if (status === "PROCESSING") return 1;
      if (status === "COMPLETED") return 2;
      return 3;
    };

    if (filter === "ALL") {
      list.sort((a, b) => {
        const pa = priority(a.status);
        const pb = priority(b.status);
        if (pa !== pb) return pa - pb;
        return (a.external_id || "").localeCompare(b.external_id || "");
      });
    } else {
      list.sort((a, b) => (a.external_id || "").localeCompare(b.external_id || ""));
    }

    return list;
  }, [filteredSyncs, filter]);

  const tableTitle = useMemo(() => {
    if (filter === "ALL") return "All Syncs";
    if (filter === "ACTION_REQUIRED") return "Action Required Syncs";
    if (filter === "PROCESSING") return "Processing Syncs";
    if (filter === "COMPLETED") return "Completed Syncs";
    return "All Syncs";
  }, [filter]);

  const showActionRequiredBanner = !loading && actionRequiredCount > 0;

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Sync</h1>
        <p className="text-sm text-gray-600">
          All service workflows currently in the system.
        </p>
      </div>

      {showActionRequiredBanner && (
        <div className="rounded-lg border bg-yellow-50 p-4 flex justify-between gap-4">
          <div className="space-y-1">
            <div className="font-medium text-yellow-900">Action Required needs attention</div>
            <div className="text-sm text-yellow-800">
              You have <span className="font-semibold">{actionRequiredCount}</span> item(s) waiting for an operator decision.
            </div>
          </div>

          <div className="flex items-start gap-2 shrink-0">
            <button
              onClick={() => setFilter("ACTION_REQUIRED")}
              className="px-3 py-2 text-sm rounded-lg bg-black text-white hover:bg-gray-800"
            >
              Show Action Required
            </button>

            <Link
              href="/action-required"
              className="px-3 py-2 text-sm rounded-lg border bg-white hover:bg-gray-50"
            >
              Go to Queue →
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        <SummaryCard label="Total" value={totalCount} />
        <SummaryCard label="Action Required" value={actionRequiredCount} />
        <SummaryCard label="Processing" value={processingCount} />
        <SummaryCard label="Completed" value={completedCount} />
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterTab
          label="All"
          active={filter === "ALL"}
          onClick={() => setFilter("ALL")}
          count={totalCount}
        />
        <FilterTab
          label="Action Required"
          active={filter === "ACTION_REQUIRED"}
          onClick={() => setFilter("ACTION_REQUIRED")}
          count={actionRequiredCount}
        />
        <FilterTab
          label="Processing"
          active={filter === "PROCESSING"}
          onClick={() => setFilter("PROCESSING")}
          count={processingCount}
        />
        <FilterTab
          label="Completed"
          active={filter === "COMPLETED"}
          onClick={() => setFilter("COMPLETED")}
          count={completedCount}
        />
      </div>

      {loading ? (
        <div className="rounded-lg border bg-gray-50 p-6 text-gray-500">
          Loading Sync records…
        </div>
      ) : displaySyncs.length === 0 ? (
        <div className="rounded-lg border bg-gray-50 p-6 text-gray-500">
          {filter === "ALL"
            ? "No Sync records found."
            : `No Sync records found for ${tableTitle}.`}
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="px-4 py-3 bg-white border-b text-sm font-medium">
            {tableTitle}
          </div>

          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left text-sm">
                <th className="px-4 py-2 border-b">External ID</th>
                <th className="px-4 py-2 border-b">Status</th>
              </tr>
            </thead>

            <tbody>
              {displaySyncs.map((sync) => {
                const isUrgent = sync.status === "ACTION_REQUIRED";

                return (
                  <tr
                    key={sync.external_id}
                    className={[
                      "text-sm transition",
                      isUrgent ? "bg-yellow-50 hover:bg-yellow-100" : "bg-white hover:bg-gray-50",
                    ].join(" ")}
                  >
                    <td className="px-4 py-2 border-b">
                      <div
                        className={[
                          "flex items-center gap-2",
                          isUrgent ? "border-l-4 border-yellow-400 pl-3 -ml-3" : "",
                        ].join(" ")}
                      >
                        {isUrgent && (
                          <span className="text-yellow-700 font-bold" title="Action required">
                            !
                          </span>
                        )}

                        <Link
                          href={`/sync/${sync.external_id}`}
                          className={[
                            "hover:underline",
                            isUrgent ? "text-yellow-900 font-semibold" : "text-blue-600",
                          ].join(" ")}
                        >
                          {sync.external_id}
                        </Link>
                      </div>
                    </td>

                    <td className="px-4 py-2 border-b">
                      <StatusBadge status={sync.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
