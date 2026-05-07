"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function OperatorCompleteRO({ externalId }: { externalId: string }) {
  const router = useRouter();

  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Auto-redirect after successful completion
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => {
      router.push("/action-required");
      router.refresh();
    }, 900);
    return () => clearTimeout(t);
  }, [success, router]);

  async function submit() {
    if (loading || success) return;

    if (!reason.trim()) {
      setError("Resolution reason is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/sync/completed", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-stripe-customer-id": "DEV",
        },
        body: JSON.stringify({
          external_id: externalId,
          resolved_reason: reason.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data?.errorMessage || data?.message || "Failed to complete ticket."
        );
      }

      setSuccess(true);
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4 pt-6 border-t">
      <div className="space-y-1">
        <h3 className="text-lg font-medium">Resolve Ticket</h3>
        <p className="text-sm text-gray-600">
          Completing this action will close the ticket and archive the workflow. This cannot be undone.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Resolution reason</label>
        <textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={loading || success}
          placeholder="Briefly explain how this was resolved…"
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 disabled:bg-gray-50"
        />
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {success && (
        <div className="text-sm text-green-600">
          ✅ Ticket completed. Redirecting to Action Required…
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={loading || success || !reason.trim()}
          className={[
            "px-4 py-2 rounded text-sm font-medium text-white transition",
            loading || success || !reason.trim()
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-black hover:bg-gray-800",
          ].join(" ")}
        >
          {loading ? "Completing…" : success ? "Completed" : "Mark as Completed"}
        </button>

        <button
          onClick={() => router.push("/action-required")}
          disabled={loading}
          className="px-4 py-2 rounded border text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Go to Queue →
        </button>
      </div>
    </section>
  );
}
``