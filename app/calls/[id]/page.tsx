"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import CallCard from "@/src/components/calls/CallCard";
import CallDrawer from "@/src/components/CallDrawer";

export default function CallWithDrawerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params); // ← unwrap the promise

  const router = useRouter();
  const [calls, setCalls] = useState<any[]>([]);
  const [selectedCall, setSelectedCall] = useState<any | null>(null);
  const [loadingCalls, setLoadingCalls] = useState(true);
  const [loadingCall, setLoadingCall] = useState(true);

  // Fetch all calls
  useEffect(() => {
    async function fetchCalls() {
      try {
        const res = await fetch("/api/calls");
        const data = await res.json();
        setCalls(data || []);
      } catch (error) {
        console.error("Failed to fetch calls:", error);
      } finally {
        setLoadingCalls(false);
      }
    }

    fetchCalls();
  }, []);

  // Fetch the selected call by ID
  useEffect(() => {
    async function fetchCall() {
      try {
        const res = await fetch(`/api/calls/${id}`);
        const data = await res.json();
        setSelectedCall(data);
      } catch (error) {
        console.error("Failed to fetch call:", error);
      } finally {
        setLoadingCall(false);
      }
    }

    fetchCall();
  }, [id]);

  return (
    <div className="p-6 relative">
      <h1 className="text-2xl font-semibold mb-4">Call History</h1>

      {loadingCalls && <p>Loading calls…</p>}

      {!loadingCalls && calls.length === 0 && (
        <p className="text-gray-500">No calls found.</p>
      )}

      <div className="space-y-3">
        {calls.map((call) => (
          <CallCard key={call.call_id} call={call} />
        ))}
      </div>

      {/* Drawer */}
      <CallDrawer
        open={true}
        call={selectedCall}
        loading={loadingCall}
        onClose={() => router.push("/calls")}
      />
    </div>
  );
}