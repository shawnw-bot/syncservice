"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OperatorAddNote({ externalId }: { externalId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submitNote() {
    if (!note.trim() || loading) return;

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
          action: "add_note",
          note: note.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || data?.errorMessage || "Failed to add note.");
      }

      setNote("");
      setMessage("Note added successfully.");
      router.refresh();
    } catch (e: any) {
      setMessage(e?.message ?? "Failed to add note.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-3">
      <h3 className="text-lg font-medium">Add Operator Note</h3>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={4}
        placeholder="Enter an internal note for this ticket…"
        disabled={loading}
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 disabled:bg-gray-50"
      />

      <div className="flex items-center gap-3">
        <button
          onClick={submitNote}
          disabled={loading || !note.trim()}
          className={[
            "px-4 py-2 rounded text-sm font-medium text-white transition",
            loading || !note.trim()
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-black hover:bg-gray-800",
          ].join(" ")}
        >
          {loading ? "Saving…" : "Add Note"}
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