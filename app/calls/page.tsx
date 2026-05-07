"use client";

import { useEffect, useState } from "react";
import CallCard from "@/src/components/calls/CallCard";

export default function CallsPage() {
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [testStatus, setTestStatus] = useState<string>("");

  async function testCall() {
    try {
      setTestStatus("Sending test call...");

      const res = await fetch("/api/call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone_number: "5551234567",
          customer_phone: "5551234567",
          job_id: "test-job",
          task: "test-call",
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("Test call failed:", data);
        setTestStatus(`Test failed (HTTP ${res.status})`);
        return;
      }

      if (data?.call_id) {
        setTestStatus(`✅ Success! call_id: ${data.call_id}`);
      } else {
        setTestStatus("✅ Call succeeded (no call_id returned)");
      }
    } catch (err) {
      console.error("Test call error:", err);
      setTestStatus("Test failed — network or runtime error");
    }
  }

  useEffect(() => {
    async function fetchCalls() {
      try {
        const res = await fetch("/api/calls");
        const data = await res.json();

        let rawCalls: any[] = [];

        if (Array.isArray(data)) rawCalls = data;
        else if (Array.isArray(data.calls)) rawCalls = data.calls;
        else if (Array.isArray(data.items)) rawCalls = data.items;
        else if (Array.isArray(data.Items)) rawCalls = data.Items;

        // ✅ Normalize calls so React never renders objects
        const normalizedCalls = rawCalls.map((call) => ({
          ...call,
          summaryText:
            typeof call.summary === "string"
              ? call.summary
              : call.summary
              ? JSON.stringify(call.summary, null, 2)
              : "",
        }));

        setCalls(normalizedCalls);
      } catch (error) {
        console.error("Failed to fetch calls:", error);
        setCalls([]);
      } finally {
        setLoading(false);
      }
    }

    fetchCalls();
  }, []);

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-4">
        <h1 className="text-2xl font-semibold">Call History</h1>

        <div className="flex flex-col items-end gap-2">
          <button
            onClick={testCall}
            className="px-4 py-2 rounded bg-black text-white hover:bg-gray-800"
          >
            Test Call
          </button>

          {testStatus && (
            <div className="text-sm text-gray-600 text-right max-w-[420px]">
              {testStatus}
            </div>
          )}
        </div>
      </div>

      {loading && <p>Loading calls…</p>}

      {!loading && calls.length === 0 && (
        <p className="text-gray-500">No calls found.</p>
      )}

      <div className="space-y-3">
        {calls.map((call) => (
          <CallCard
            key={call.call_id || call.id}
            call={call}
            summaryText={call.summaryText}
          />
        ))}
      </div>
    </div>
  );
}
