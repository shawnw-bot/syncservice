import { notFound } from "next/navigation";

type CustomerUpdate = {
  note: string;
  created_at: string;
  author?: string;
};

async function fetchTicket(externalId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/sync/by-external/${externalId}`, {
    cache: "no-store",
  });

  if (!res.ok) return null;

  const data = await res.json().catch(() => ({}));
  return data?.item ?? null;
}

function mapStatus(status: string) {
  if (status === "COMPLETED") {
    return {
      title: "Repair Completed ✅",
      message: "Your vehicle is ready.",
      color: "#10B981",
      bg: "#ECFDF5",
      border: "#6EE7B7",
    };
  }

  if (status === "ACTION_REQUIRED") {
    return {
      title: "Waiting for Approval",
      message: "We’re waiting for your approval before continuing.",
      color: "#B45309",
      bg: "#FFFBEB",
      border: "#FDE68A",
    };
  }

  return {
    title: "In Progress",
    message: "Your vehicle is currently being worked on.",
    color: "#1D4ED8",
    bg: "#EFF6FF",
    border: "#BFDBFE",
  };
}

function normalizeUpdates(ticket: any): CustomerUpdate[] {
  const updates: CustomerUpdate[] = [];

  // Preferred: full list
  if (Array.isArray(ticket?.customer_updates)) {
    for (const u of ticket.customer_updates) {
      if (u?.note && u?.created_at) updates.push(u);
    }
  }

  // Fallback: latest only
  if (updates.length === 0 && ticket?.latest_customer_update?.note && ticket?.latest_customer_update?.created_at) {
    updates.push(ticket.latest_customer_update);
  }

  // Sort newest first
  updates.sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    return tb - ta;
  });

  return updates;
}

export default async function TrackPage({
  params,
}: {
  params: Promise<{ externalId: string }>;
}) {
  const { externalId } = await params;

  const ticket = await fetchTicket(externalId);
  if (!ticket) notFound();

  const display = mapStatus(ticket.status);
  const updates = normalizeUpdates(ticket);

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>Track Your Repair</h1>

        <div style={idStyle}>Ticket ID: {ticket.external_id}</div>

        <div style={{ ...statusBox, backgroundColor: display.bg, borderColor: display.border }}>
          <h2 style={{ color: display.color, marginBottom: "6px" }}>{display.title}</h2>
          <p style={messageStyle}>{display.message}</p>
        </div>

        {/* ✅ Advisor Update Timeline */}
        {updates.length > 0 && (
          <div style={timelineWrap}>
            <div style={timelineHeader}>Updates from your service advisor</div>

            <div style={timelineList}>
              {updates.map((u, idx) => (
                <div key={`${u.created_at}-${idx}`} style={timelineRow}>
                  <div style={timelineRail}>
                    <div style={timelineDot} />
                    {idx !== updates.length - 1 && <div style={timelineLine} />}
                  </div>

                  <div style={timelineContent}>
                    <div style={timelineText}>{u.note}</div>
                    <div style={timelineTime}>
                      {new Date(u.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Required reason */}
        {ticket.action_required_reason && ticket.status === "ACTION_REQUIRED" && (
          <div style={alertStyle}>
            <strong>Action Required:</strong>
            <p style={{ marginTop: "6px" }}>{ticket.action_required_reason}</p>
          </div>
        )}

        <div style={footerStyle}>
          <p>Questions? Contact your service advisor.</p>
        </div>
      </div>
    </main>
  );
}

/* Styles */
const pageStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#F8FAFC",
  padding: "20px",
};

const cardStyle = {
  backgroundColor: "white",
  borderRadius: "12px",
  padding: "32px",
  maxWidth: "560px",
  width: "100%",
  border: "1px solid #E2E8F0",
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
  textAlign: "center" as const,
};

const titleStyle = { fontSize: "24px", fontWeight: 800, marginBottom: "8px" };
const idStyle = { fontSize: "13px", color: "#64748B", marginBottom: "20px" };

const statusBox = {
  border: "2px solid",
  borderRadius: "10px",
  padding: "18px 20px",
  marginBottom: "16px",
  textAlign: "left" as const,
};

const messageStyle = { fontSize: "14px", color: "#334155", lineHeight: "1.5" };

const timelineWrap = {
  backgroundColor: "#F1F5F9",
  border: "1px solid #E2E8F0",
  borderRadius: "10px",
  padding: "14px 16px",
  textAlign: "left" as const,
  marginBottom: "16px",
};

const timelineHeader = {
  fontSize: "13px",
  fontWeight: 800,
  color: "#0F172A",
  marginBottom: "10px",
};

const timelineList = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "12px",
};

const timelineRow = {
  display: "flex",
  gap: "12px",
  alignItems: "flex-start" as const,
};

const timelineRail = {
  width: "14px",
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center" as const,
};

const timelineDot = {
  width: "10px",
  height: "10px",
  borderRadius: "999px",
  backgroundColor: "#0A4D9C",
  marginTop: "3px",
};

const timelineLine = {
  width: "2px",
  flex: 1,
  backgroundColor: "#CBD5E1",
  marginTop: "6px",
};

const timelineContent = { flex: 1 };

const timelineText = {
  fontSize: "14px",
  color: "#334155",
  lineHeight: "1.5",
};

const timelineTime = {
  fontSize: "12px",
  color: "#64748B",
  marginTop: "6px",
};

const alertStyle = {
  backgroundColor: "#FEF3C7",
  border: "1px solid #FDE68A",
  padding: "12px",
  borderRadius: "8px",
  fontSize: "14px",
  marginBottom: "16px",
  textAlign: "left" as const,
};

const footerStyle = { fontSize: "12px", color: "#94A3B8" };