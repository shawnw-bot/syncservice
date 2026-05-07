"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Channel = "both" | "sms" | "email";

export default function SendCustomerUpdate({
  externalId,
  latestNote,
}: {
  externalId: string;
  latestNote: string | null;
}) {
  const router = useRouter();
  const [channel, setChannel] = useState<Channel>("both");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const disabled = useMemo(() => !latestNote || !latestNote.trim(), [latestNote]);

  async function send() {
    if (disabled || loading) return;

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/notify/customer-update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-stripe-customer-id": "DEV",
        },
        body: JSON.stringify({
          external_id: externalId,
          note: latestNote,
          channel,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to send update.");
      }

      const status = data?.notification?.status;

      if (status === "no_contact_on_ticket") {
        setMessage("No customer phone/email found on this ticket yet. (Saved to notification log.)");
      } else {
        setMessage("Update sent (queued).");
      }

      router.refresh();
    } catch (e: any) {
      setMessage(e?.message ?? "Failed to send update.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-lg border bg-white p-4 space-y-3">
      <div className="space-y-1">
        <h3 className="text-lg font-medium">Send Update to Customer</h3>
        <p className="text-sm text-gray-600">
          Sends the <span className="font-medium">latest advisor update</span> with the tracking link.
        </p>
      </div>

      <div className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-700">
        {latestNote?.trim() ? latestNote : "No advisor update posted yet."}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value as Channel)}
          className="rounded-lg border px-3 py-2 text-sm bg-white"
          disabled={loading}
        >
          <option value="both">Send via SMS + Email</option>
          <option value="sms">Send via SMS only</option>
          <option value="email">Send via Email only</option>
        </select>

        <button
          onClick={send}
          disabled={loading || disabled}
          className={[
            "px-4 py-2 rounded text-sm font-medium text-white transition",
            loading || disabled
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-black hover:bg-gray-800",
          ].join(" ")}
        >
          {loading ? "Sending…" : "Send Update"}
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