"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type RawItem = any;

type TicketRow = {
  external_id: string;
  status: string;
  created_at?: string;
  action_required_reason?: string;
};

async function fetchTickets(): Promise<RawItem[]> {
  const res = await fetch("/api/sync", { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  return data.items ?? [];
}

/**
 * Normalize /api/sync into ticket rows:
 * - external_id is required (derive from SK EXT#... if present)
 * - created_at uses received_at/action_required_at/created_at best effort
 */
function normalize(items: RawItem[]): TicketRow[] {
  const out: TicketRow[] = [];

  for (const it of items ?? []) {
    const externalId =
      it?.external_id ??
      it?.externalId ??
      (typeof it?.SK === "string" && it.SK.startsWith("EXT#")
        ? it.SK.slice(4)
        : null);

    if (!externalId || typeof externalId !== "string") continue;

    const status = String(it?.status ?? "UNKNOWN");

    const created_at =
      it?.received_at ??
      it?.action_required_at ??
      it?.created_at ??
      it?.createdAt ??
      undefined;

    out.push({
      external_id: externalId,
      status,
      created_at,
      action_required_reason:
        it?.action_required_reason ?? it?.actionRequiredReason ?? undefined,
    });
  }

  // newest first (best effort)
  out.sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });

  return out;
}

/**
 * Map Sync state machine into Base44-like ticket filter buckets.
 * - draft: early pipeline
 * - in_progress: any non-completed state (including action required)
 * - completed: completed
 */
function toBucket(status: string): "draft" | "in_progress" | "completed" {
  if (status === "COMPLETED") return "completed";
  if (status === "CREATED" || status === "INGESTED") return "draft";
  return "in_progress";
}

const STATUS_LABEL: Record<string, string> = {
  all: "All",
  draft: "Draft",
  in_progress: "In Progress",
  completed: "Completed",
};

const STATUS_COLOR: Record<string, string> = {
  draft: "#9CA3AF",
  in_progress: "#3B82F6",
  completed: "#10B981",
};

const STATUS_BG: Record<string, string> = {
  draft: "#F3F4F6",
  in_progress: "#EFF6FF",
  completed: "#ECFDF5",
};

export default function TicketsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "draft" | "in_progress" | "completed">("all");

  useEffect(() => {
    async function load() {
      try {
        const raw = await fetchTickets();
        setRows(normalize(raw));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((r) => {
      const bucket = toBucket(r.status);
      const matchStatus = filter === "all" || bucket === filter;

      const matchSearch =
        !q ||
        r.external_id.toLowerCase().includes(q) ||
        (r.action_required_reason ?? "").toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q);

      return matchStatus && matchSearch;
    });
  }, [rows, search, filter]);

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={h1Style}>Tickets</h1>
          <p style={subtitleStyle}>
            {rows.length} total ticket{rows.length !== 1 ? "s" : ""}
          </p>
        </div>

        <button
          onClick={() => router.push("/tickets/create")}
          style={newBtnStyle}
        >
          + New Ticket
        </button>
      </div>

      {/* Filters + Search */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "20px" }}>
        <div style={searchWrap}>
          <span style={{ fontSize: "13px", color: "#9CA3AF" }}>🔎</span>
          <input
            placeholder="Search by ID, status, reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={searchInput}
          />
        </div>

        {(["all", "draft", "in_progress", "completed"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "1px solid",
              borderColor: filter === s ? "#0A4D9C" : "#E5E7EB",
              backgroundColor: filter === s ? "#EFF6FF" : "white",
              color: filter === s ? "#0A4D9C" : "#6B7280",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#9CA3AF" }}>
          <p style={{ fontSize: "16px" }}>No tickets found.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {filtered.map((r) => {
            const bucket = toBucket(r.status);
            return (
              <div
                key={r.external_id}
                onClick={() => router.push(`/sync/${r.external_id}`)}
                style={rowStyle}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "15px", fontWeight: 700, color: "#111", marginBottom: "3px" }}>
                    {r.external_id}
                  </div>

                  <div style={{ fontSize: "13px", color: "#6B7280" }}>
                    {r.action_required_reason ? r.action_required_reason : r.status}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
                  <span
                    style={{
                      backgroundColor: STATUS_BG[bucket],
                      color: STATUS_COLOR[bucket],
                      fontSize: "12px",
                      fontWeight: 700,
                      padding: "3px 10px",
                      borderRadius: "20px",
                    }}
                  >
                    {STATUS_LABEL[bucket]}
                  </span>

                  <span style={{ fontSize: "12px", color: "#C4C4C4" }}>
                    {r.created_at
                      ? new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                      : ""}
                  </span>

                  <span style={{ fontSize: "14px", color: "#C4C4C4" }}>›</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div
      style={{
        width: "28px",
        height: "28px",
        border: "3px solid #E5E7EB",
        borderTopColor: "#0A4D9C",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
      }}
    />
  );
}

const pageStyle = {
  minHeight: "100vh",
  backgroundColor: "#F1F5F9",
  padding: "32px 24px 64px",
  fontFamily: "'Inter','SF Pro Display','Roboto',sans-serif",
  maxWidth: "900px",
  margin: "0 auto",
};

const h1Style = { fontSize: "26px", fontWeight: 800, color: "#0F172A", letterSpacing: "-0.5px", marginBottom: "2px" };
const subtitleStyle = { fontSize: "13px", color: "#64748B" };

const newBtnStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "10px 20px",
  backgroundColor: "#0A4D9C",
  color: "white",
  fontSize: "14px",
  fontWeight: 700,
  border: "none",
  borderRadius: "9px",
  cursor: "pointer",
  fontFamily: "inherit",
};

const searchWrap = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  backgroundColor: "white",
  border: "1px solid #E5E7EB",
  borderRadius: "8px",
  padding: "8px 14px",
  flex: 1,
  minWidth: "200px",
};

const searchInput = {
  border: "none",
  outline: "none",
  fontSize: "13px",
  color: "#333",
  width: "100%",
  fontFamily: "inherit",
  background: "transparent",
};

const rowStyle = {
  backgroundColor: "white",
  borderRadius: "10px",
  padding: "16px 20px",
  border: "1px solid #E2E8F0",
  display: "flex",
  alignItems: "center",
  gap: "16px",
  cursor: "pointer",
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  transition: "box-shadow 0.15s",
};
