"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type RawItem = any;

type SyncItem = {
  external_id: string;
  status: string;
  received_at?: string;
  action_required_at?: string;
};

type IconName = "ticket" | "clock" | "check" | "car" | "alert" | "trend";

function Icon({
  name,
  color = "#0F172A",
  size = 20,
}: {
  name: IconName;
  color?: string;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
  } as const;

  switch (name) {
    case "ticket":
      return (
        <svg {...common} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4V7z" />
          <path d="M9 7v2" />
          <path d="M9 15v2" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v6l4 2" />
        </svg>
      );
    case "check":
      return (
        <svg {...common} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12l2.5 2.5L16 9" />
        </svg>
      );
    case "car":
      return (
        <svg {...common} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 16l1-5a3 3 0 0 1 3-2h6a3 3 0 0 1 3 2l1 5" />
          <path d="M7 16h10" />
          <circle cx="8" cy="16.5" r="1.5" />
          <circle cx="16" cy="16.5" r="1.5" />
        </svg>
      );
    case "alert":
      return (
        <svg {...common} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l10 18H2L12 3z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      );
    case "trend":
      return (
        <svg {...common} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 16l6-6 4 4 6-8" />
          <path d="M20 6v6h-6" />
        </svg>
      );
    default:
      return null;
  }
}

async function fetchSyncs(): Promise<RawItem[]> {
  const res = await fetch("/api/sync", { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  return data.items ?? [];
}

/**
 * Normalize /api/sync results so Dashboard never breaks on mixed-item tables.
 * - Accept external_id or externalId or derive from SK "EXT#..."
 * - Keep received_at/action_required_at when present
 */
function normalize(items: RawItem[]): SyncItem[] {
  const out: SyncItem[] = [];

  for (const it of items ?? []) {
    const status = String(it?.status ?? "UNKNOWN");
    const externalId =
      it?.external_id ??
      it?.externalId ??
      (typeof it?.SK === "string" && it.SK.startsWith("EXT#") ? it.SK.slice(4) : null);

    if (!externalId || typeof externalId !== "string") continue;

    out.push({
      external_id: externalId,
      status,
      received_at: it?.received_at ?? it?.receivedAt ?? undefined,
      action_required_at: it?.action_required_at ?? it?.actionRequiredAt ?? undefined,
    });
  }

  return out;
}

function safeDateKey(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toDateString();
}

export default function DashboardPage() {
  const router = useRouter();
  const [syncs, setSyncs] = useState<SyncItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const raw = await fetchSyncs();
        setSyncs(normalize(raw));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ✅ State mapping (Choice A)
  const counts = useMemo(() => {
    const actionRequired = syncs.filter((s) => s.status === "ACTION_REQUIRED");
    const completed = syncs.filter((s) => s.status === "COMPLETED");
    const failed = syncs.filter((s) => s.status === "FAILED");

    // Processing = EVERYTHING else (includes CREATED, INGESTED, PROCESSING, AWAITING_AI, AI_COMPLETED, RECEIVED, UNKNOWN)
    const processing = syncs.filter(
      (s) => s.status !== "ACTION_REQUIRED" && s.status !== "COMPLETED" && s.status !== "FAILED"
    );

    return {
      total: syncs.length,
      actionRequired: actionRequired.length,
      completed: completed.length,
      failed: failed.length,
      processing: processing.length,
    };
  }, [syncs]);

  // New tickets today: use received_at first; fallback action_required_at
  const todayKey = new Date().toDateString();
  const newToday = useMemo(() => {
    return syncs.filter((s) => {
      const key = safeDateKey(s.received_at) ?? safeDateKey(s.action_required_at);
      return key === todayKey;
    }).length;
  }, [syncs, todayKey]);

  const waitingApproval = counts.actionRequired;
  const inProgress = counts.processing;
  const done = counts.completed;

  const statusSegments = [
    { label: "Action Required", count: counts.actionRequired, color: "#F59E0B" },
    { label: "Processing", count: counts.processing, color: "#3B82F6" },
    { label: "Completed", count: counts.completed, color: "#10B981" },
  ];

  const alerts: { text: string; color: string; route?: string }[] = [];
  if (waitingApproval > 0) {
    alerts.push({
      text: `${waitingApproval} ticket${waitingApproval > 1 ? "s" : ""} waiting on action`,
      color: "#F59E0B",
      route: "/action-required",
    });
  }
  if (counts.failed > 0) {
    alerts.push({
      text: `${counts.failed} ticket${counts.failed > 1 ? "s" : ""} failed`,
      color: "#EF4444",
      route: "/sync",
    });
  }

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-4 border-gray-200 border-t-black animate-spin" />
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={h1Style}>Dashboard</h1>
        <p style={subtitleStyle}>
          Today&apos;s Overview —{" "}
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Key Metrics */}
      <div style={gridRow4}>
        <MetricCard icon="ticket" color="#3B82F6" label="New Tickets Today" value={newToday} />
        <MetricCard icon="clock" color="#F59E0B" label="Waiting on Approval" value={waitingApproval} />
        <MetricCard icon="trend" color="#8B5CF6" label="Jobs In Progress" value={inProgress} />
        <MetricCard icon="check" color="#10B981" label="Completed Jobs" value={done} />
      </div>

      {/* Status Segments */}
      <div style={sectionCard}>
        <h2 style={sectionTitle}>Active Ticket Summary</h2>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          {statusSegments.map((seg) => (
            <div key={seg.label} style={segmentPill(seg.color)}>
              <span style={{ fontSize: "22px", fontWeight: 800, lineHeight: 1 }}>{seg.count}</span>
              <span style={{ fontSize: "12px", fontWeight: 500, opacity: 0.9, marginTop: "2px" }}>{seg.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Today's Workload + Quick Actions */}
      <div style={gridRow2}>
        <div style={sectionCard}>
          <h2 style={sectionTitle}>Today&apos;s Activity</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <ActivityRow icon="car" label="Tickets created today" value={newToday} color="#3B82F6" />
            <ActivityRow icon="check" label="Tickets completed today" value={done} color="#10B981" />
            <ActivityRow icon="clock" label="Jobs in progress" value={inProgress} color="#8B5CF6" />
            <ActivityRow icon="alert" label="Waiting on customer" value={waitingApproval} color="#F59E0B" />
          </div>
        </div>

        <div style={sectionCard}>
          <h2 style={sectionTitle}>Quick Actions</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <QuickBtn label="Create New Ticket" onClick={() => router.push("/tickets/create")} primary />
            <QuickBtn label="View All Tickets" onClick={() => router.push("/sync")} />
            <QuickBtn label="View Action Required" onClick={() => router.push("/action-required")} />
            <QuickBtn label="Manager View" onClick={() => router.push("/manager")} />
          </div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div style={sectionCard}>
          <h2 style={sectionTitle}>Alerts & Notifications</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {alerts.map((a, idx) => (
              <div
                key={idx}
                style={alertRow(Boolean(a.route))}
                onClick={() => a.route && router.push(a.route)}
              >
                <div
                  style={{
                    width: "34px",
                    height: "34px",
                    borderRadius: "8px",
                    backgroundColor: a.color + "20",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon name="alert" size={16} color={a.color} />
                </div>
                <span style={{ fontSize: "14px", color: "#333", flex: 1 }}>{a.text}</span>
                {a.route && <span style={{ fontSize: "12px", color: "#9CA3AF" }}>→</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  color,
  label,
  value,
}: {
  icon: IconName;
  color: string;
  label: string;
  value: number;
}) {
  return (
    <div style={metricCardStyle}>
      <div
        style={{
          width: "44px",
          height: "44px",
          borderRadius: "12px",
          backgroundColor: color + "18",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon name={icon} size={22} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "30px", fontWeight: 800, color: "#111", lineHeight: 1.1 }}>
          {value}
        </div>
        <div style={{ fontSize: "12px", color: "#6B7280", marginTop: "4px", fontWeight: 500 }}>
          {label}
        </div>
      </div>
    </div>
  );
}

function ActivityRow({
  icon,
  label,
  value,
  color,
}: {
  icon: IconName;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      <Icon name={icon} size={16} color={color} />
      <span style={{ fontSize: "14px", color: "#444", flex: 1 }}>{label}</span>
      <span style={{ fontSize: "16px", fontWeight: 700, color: "#111" }}>{value}</span>
    </div>
  );
}

function QuickBtn({
  label,
  onClick,
  primary,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: "12px 16px",
        backgroundColor: primary ? "#0A4D9C" : "white",
        color: primary ? "white" : "#0A4D9C",
        border: `1px solid ${primary ? "#0A4D9C" : "#DBEAFE"}`,
        borderRadius: "8px",
        fontSize: "14px",
        fontWeight: 600,
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "'Inter','SF Pro Display','Roboto',sans-serif",
      }}
    >
      {label}
    </button>
  );
}

// Styles (Base44-like)
const pageStyle = {
  minHeight: "100vh",
  backgroundColor: "#F1F5F9",
  padding: "32px 24px 64px",
  fontFamily: "'Inter','SF Pro Display','Roboto',sans-serif",
  maxWidth: "1100px",
  margin: "0 auto",
};

const h1Style = {
  fontSize: "28px",
  fontWeight: 800,
  color: "#0F172A",
  letterSpacing: "-0.5px",
  marginBottom: "4px",
};

const subtitleStyle = {
  fontSize: "14px",
  color: "#64748B",
  fontWeight: 400,
};

const sectionTitle = {
  fontSize: "16px",
  fontWeight: 700,
  color: "#0F172A",
  marginBottom: "16px",
  letterSpacing: "-0.2px",
};

const gridRow4 = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "16px",
  marginBottom: "20px",
};

const gridRow2 = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "16px",
  marginBottom: "20px",
};

const sectionCard = {
  backgroundColor: "white",
  borderRadius: "12px",
  padding: "24px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  border: "1px solid #E2E8F0",
  marginBottom: "20px",
};

const metricCardStyle = {
  backgroundColor: "white",
  borderRadius: "12px",
  padding: "20px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  border: "1px solid #E2E8F0",
  display: "flex",
  alignItems: "center",
  gap: "16px",
};

const segmentPill = (color: string) => ({
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: color,
  color: "white",
  borderRadius: "10px",
  padding: "14px 24px",
  minWidth: "130px",
  gap: "4px",
});

const alertRow = (_hasLink: boolean) => ({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "12px",
  borderRadius: "8px",
  backgroundColor: "#FAFAFA",
  border: "1px solid #F1F5F9",
  cursor: "pointer",
});