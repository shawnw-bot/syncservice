"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OperatorFlagFollowUp({ externalId }: { externalId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submitFollowUp() {
    if (!reason.trim() || loading) return;

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/sync/operator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-stripe-customer-id": "DEV",
        },
        body: JSON.stringify({
          external_id: externalId,
          action: "flag_followup",
          reason: reason.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || data?.errorMessage || "Failed to flag follow-up.");
      }

      setReason("");
      setMessage("Follow-up flagged successfully.");
      router.refresh();
    } catch (e: any) {
      setMessage(e?.message ?? "Failed to flag follow-up.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-3">
      <h3 className="text-lg font-medium">Flag Follow‑up</h3>

      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="Why is follow‑up required?"
        disabled={loading}
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 disabled:bg-gray-50"
      />

      <div className="flex items-center gap-3">
        <button
          onClick={submitFollowUp}
          disabled={loading || !reason.trim()}
          className={[
            "px-4 py-2 rounded text-sm font-medium text-white transition",
            loading || !reason.trim()
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-black hover:bg-gray-800",
          ].join(" ")}
        >
          {loading ? "Saving…" : "Flag Follow‑up"}
        </button>

        {message && (
          <span
            className={`text-sm ${
              message.toLowerCase().includes("failed") ? "text-red-600" : "text-green-600"
            }`}
          >
            {message}
          </span>
        )}
      </div>
    </section>
  );
}