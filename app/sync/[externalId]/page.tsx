import Link from "next/link";
import CopyCustomerLink from "./CopyCustomerLink";
import AdvisorCustomerUpdate from "./AdvisorCustomerUpdate";
import SendCustomerUpdate from "./SendCustomerUpdate";

import OperatorAddNote from "./OperatorAddNote";
import OperatorFlagFollowUp from "./OperatorFlagFollowUp";
import OperatorCompleteRO from "./OperatorCompleteRO";

type CustomerUpdate = {
  note: string;
  created_at: string;
  author?: string;
};

type SyncRecord = {
  external_id: string;
  status: string;
  action_required_reason?: string;
  operator_notes?: { note: string; created_at: string }[];
  follow_up_required?: boolean;
  follow_up_reason?: string;
  resolved_at?: string;
  resolved_reason?: string;

  latest_customer_update?: CustomerUpdate;
  customer_updates?: CustomerUpdate[];
};

async function fetchTicket(externalId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/sync/by-external/${externalId}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch Ticket record");
  }

  const data = await res.json();
  return data.item as SyncRecord;
}

function TopNav() {
  return (
    <div className="flex items-center justify-between text-sm text-gray-600">
      <Link href="/tickets" className="underline">
        ← Back to Tickets
      </Link>

      <Link href="/action-required" className="underline">
        Go to Action Required →
      </Link>
    </div>
  );
}

function normalizeUpdates(ticket: SyncRecord): CustomerUpdate[] {
  const updates: CustomerUpdate[] = [];

  if (Array.isArray(ticket.customer_updates)) {
    for (const u of ticket.customer_updates) {
      if (u?.note && u?.created_at) updates.push(u);
    }
  }

  if (
    updates.length === 0 &&
    ticket.latest_customer_update?.note &&
    ticket.latest_customer_update?.created_at
  ) {
    updates.push(ticket.latest_customer_update);
  }

  updates.sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    return tb - ta;
  });

  return updates;
}

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ externalId: string }>;
}) {
  const { externalId } = await params;
  const ticket = await fetchTicket(externalId);

  const isCompleted = ticket.status === "COMPLETED";
  const isActionRequired = ticket.status === "ACTION_REQUIRED";
  const updates = normalizeUpdates(ticket);

  const latestNote = ticket.latest_customer_update?.note ?? null;

  return (
    <section className="space-y-8 max-w-3xl">
      <TopNav />

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Ticket Detail</h1>
        <p className="text-sm text-gray-600">
          Review and take action on this service ticket.
        </p>
      </div>

      <CopyCustomerLink externalId={ticket.external_id} />

      {!isCompleted && <AdvisorCustomerUpdate externalId={ticket.external_id} />}

      {/* ✅ Send latest update button */}
      {!isCompleted && (
        <SendCustomerUpdate externalId={ticket.external_id} latestNote={latestNote} />
      )}

      {/* Ticket Info */}
      <div className="rounded-lg border bg-white p-4 space-y-2 text-sm">
        <div>
          <span className="text-gray-500">External ID:</span>{" "}
          <span className="font-medium">{ticket.external_id}</span>
        </div>

        <div>
          <span className="text-gray-500">Status:</span>{" "}
          <span className="font-medium">{ticket.status}</span>
        </div>

        {ticket.action_required_reason && (
          <div>
            <span className="text-gray-500">Action Required Reason:</span>{" "}
            {ticket.action_required_reason}
          </div>
        )}
      </div>

      {/* Customer Updates Timeline */}
      {updates.length > 0 && (
        <section className="rounded-lg border bg-gray-50 p-4 space-y-3">
          <h2 className="text-lg font-medium">Customer Updates</h2>

          <div className="space-y-3">
            {updates.map((u, idx) => (
              <div key={`${u.created_at}-${idx}`} className="rounded-lg border bg-white p-3">
                <div className="text-sm text-gray-900">{u.note}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(u.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Operator Notes */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Operator Notes</h2>

        {!ticket.operator_notes || ticket.operator_notes.length === 0 ? (
          <p className="text-sm text-gray-600">No notes added yet.</p>
        ) : (
          <ul className="space-y-2">
            {ticket.operator_notes.map((n, i) => (
              <li key={i} className="rounded border bg-white p-3">
                <div>{n.note}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!isCompleted && (
        <div className="space-y-4">
          <OperatorAddNote externalId={ticket.external_id} />
          <OperatorFlagFollowUp externalId={ticket.external_id} />
        </div>
      )}

      {isCompleted ? (
        <section className="space-y-3 pt-4 border-t">
          <h2 className="text-lg font-medium">Ticket Completed</h2>
          <p className="text-sm text-gray-600">✅ This ticket has been closed.</p>
        </section>
      ) : isActionRequired ? (
        <OperatorCompleteRO externalId={ticket.external_id} />
      ) : null}
    </section>
  );
}