// app/customer/sync/[externalId]/page.tsx
import Link from "next/link";

type SyncRecord = {
  external_id: string;
  status: string;
  received_at?: string;
  action_required_at?: string;
  action_required_reason?: string;
  follow_up_required?: boolean;
  follow_up_reason?: string;
  resolved_at?: string;
  resolved_reason?: string;
  vehicle_id?: string | null;
};

type FetchResult =
  | { type: "ok"; item: SyncRecord }
  | { type: "not_found" }
  | { type: "denied" };

function friendlyStatus(status: string) {
  switch (status) {
    case "CREATED":
    case "INGESTED":
    case "PROCESSING":
    case "AWAITING_AI":
      return "In progress";
    case "AI_COMPLETED":
      return "Review in progress";
    case "ACTION_REQUIRED":
      return "Approval needed";
    case "COMPLETED":
      return "Completed";
    case "FAILED":
      return "Needs attention";
    default:
      return status;
  }
}

async function fetchCustomerSync(externalId: string, token: string | null) {
  if (!token) return { type: "denied" } as const;

  const res = await fetch(
    `http://localhost:3000/api/customer/sync/${externalId}?token=${encodeURIComponent(
      token
    )}`,
    { cache: "no-store" }
  );

  if (res.status === 401 || res.status === 403) return { type: "denied" } as const;
  if (res.status === 404) return { type: "not_found" } as const;
  if (!res.ok) throw new Error("Failed to fetch customer sync");

  const data = await res.json();
  return { type: "ok", item: data.item as SyncRecord } as const;
}

export default async function CustomerSyncPage({
  params,
  searchParams,
}: {
  params: Promise<{ externalId: string }>;
  searchParams?: Promise<{ token?: string }> | { token?: string };
}) {
  // ✅ In your project, params is a Promise — unwrap it
  const { externalId } = await params;

  // ✅ searchParams may or may not be a Promise depending on runtime — handle both
  const sp =
    searchParams && typeof (searchParams as any).then === "function"
      ? await (searchParams as Promise<{ token?: string }>)
      : (searchParams as { token?: string } | undefined);

  const token = sp?.token ?? null;

  const result = await fetchCustomerSync(externalId, token);

  if (result.type === "denied") {
    return (
      <main className="p-6 max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold">Service Update</h1>

        <div className="border rounded-lg p-6 bg-gray-50">
          <h2 className="text-lg font-semibold">Access Required</h2>
          <p className="text-sm text-gray-600 mt-2">
            This service record is not available from this link right now. Please
            contact your service advisor for access.
          </p>
          <p className="text-xs text-gray-500 mt-3">
            Reference ID: <span className="font-mono">{externalId}</span>
          </p>
        </div>

        <Link href="/" className="text-blue-600 hover:underline text-sm">
          Back to home →
        </Link>
      </main>
    );
  }

  if (result.type === "not_found") {
    return (
      <main className="p-6 max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold">Service Update</h1>

        <div className="border rounded-lg p-6 bg-gray-50">
          <h2 className="text-lg font-semibold">Record not found</h2>
          <p className="text-sm text-gray-600 mt-2">
            We couldn’t find a service record for this link.
          </p>
          <p className="text-xs text-gray-500 mt-3">
            Reference ID: <span className="font-mono">{externalId}</span>
          </p>
        </div>

        <Link href="/" className="text-blue-600 hover:underline text-sm">
          Back to home →
        </Link>
      </main>
    );
  }

  const sync = result.item;
  const statusLabel = friendlyStatus(sync.status);

  return (
    <main className="p-6 max-w-2xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Service Update</h1>
        <p className="text-sm text-gray-600">
          Reference ID: <span className="font-mono">{sync.external_id}</span>
        </p>
      </header>

      <section className="border rounded-lg p-5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">Current status</div>
          <div className="text-sm font-semibold">{statusLabel}</div>
        </div>

        {sync.action_required_reason && (
          <div className="text-sm text-gray-700 mt-3">
            <div className="font-semibold">Advisor note</div>
            <div className="text-gray-600">{sync.action_required_reason}</div>
          </div>
        )}

        {sync.follow_up_required && (
          <div className="text-sm text-gray-700 mt-3">
            <div className="font-semibold">Follow‑up</div>
            <div className="text-gray-600">
              {sync.follow_up_reason ?? "Follow‑up required."}
            </div>
          </div>
        )}

        {sync.resolved_reason && (
          <div className="text-sm text-gray-700 mt-3">
            <div className="font-semibold">Completion</div>
            <div className="text-gray-600">{sync.resolved_reason}</div>
          </div>
        )}

        {sync.resolved_at && (
          <div className="text-xs text-gray-500 mt-2">
            Completed at: {new Date(sync.resolved_at).toLocaleString()}
          </div>
        )}
      </section>

      <footer className="text-xs text-gray-500">
        Questions? Contact your service advisor and reference the ID above.
      </footer>
    </main>
  );
}