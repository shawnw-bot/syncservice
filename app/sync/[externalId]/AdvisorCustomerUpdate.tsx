"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdvisorCustomerUpdate({ externalId }: { externalId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    if (!text.trim() || loading) return;

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/sync/customer-update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-stripe-customer-id": "DEV",
        },
        body: JSON.stringify({
          external_id: externalId,
          note: text.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || data?.errorMessage || "Failed to post customer update.");
      }

      setText("");
      setMessage("Customer update posted.");
      router.refresh();
    } catch (e: any) {
      setMessage(e?.message ?? "Failed to post customer update.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-3">
      <h3 className="text-lg font-medium">Customer Update (Visible to Customer)</h3>
      <p className="text-sm text-gray-600">
        Add a short status message the customer will see on their tracking page.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Example: Waiting on your oil filter from NAPA. We’ll update you as soon as it arrives."
        disabled={loading}
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 disabled:bg-gray-50"
      />

      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={loading || !text.trim()}
          className={[
            "px-4 py-2 rounded text-sm font-medium text-white transition",
            loading || !text.trim()
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-black hover:bg-gray-800",
          ].join(" ")}
        >
          {loading ? "Posting…" : "Post Update"}
        </button>

        {message && (
          <span className={`text-sm ${message.toLowerCase().includes("failed") ? "text-red-600" : "text-green-600"}`}>
            {message}
          </span>
        )}
      </div>
    </section>
  );
}