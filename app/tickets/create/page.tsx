"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CreateTicketPage() {
  const router = useRouter();

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [concern, setConcern] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!customerName || !vehicle) return;

    setLoading(true);

    await fetch("/api/sync/ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-stripe-customer-id": "DEV",
      },
      body: JSON.stringify({
        external_id: `RO-${Date.now()}`,

        // ✅ Keep flat fields (for UI)
        customer_name: customerName,
        phone,
        email,
        vehicle,
        concern,

        // ✅ CRITICAL: structured payload for notifications
        payload: {
          customer: {
            name: customerName,
            phone,
            email,
          },
          vehicle,
          concern,
        },

        // ✅ Dashboard visibility
        golden: true,
        action_required_reason: concern || "Needs review",
      }),
    }).catch(() => {});

    setLoading(false);

    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="max-w-xl mx-auto bg-white border rounded-xl p-8 space-y-6">

        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Create Ticket
          </h1>
          <p className="text-sm text-gray-600">
            Enter customer + vehicle info to start a new workflow.
          </p>
        </div>

        <div className="space-y-4">

          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Customer Name"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />

          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Customer Phone"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Customer Email"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />

          <input
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
            placeholder="Year / Make / Model"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />

          <textarea
            value={concern}
            onChange={(e) => setConcern(e.target.value)}
            placeholder="Customer Concern / Tech Findings"
            rows={4}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />

        </div>

        <div className="flex gap-3">

          <button
            onClick={submit}
            disabled={loading || !customerName || !vehicle}
            className={[
              "px-4 py-2 rounded text-sm font-medium text-white",
              loading
                ? "bg-gray-400"
                : "bg-black hover:bg-gray-800",
            ].join(" ")}
          >
            {loading ? "Creating..." : "Create Ticket"}
          </button>

          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 rounded border text-sm text-gray-700 hover:bg-white"
          >
            Cancel
          </button>

        </div>

      </div>
    </main>
  );
}