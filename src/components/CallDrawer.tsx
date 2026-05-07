"use client";

import React from "react";
import StatusBadge from "@/src/components/calls/StatusBadge";
import CallHeader from "@/src/components/call/CallHeader";

interface TranscriptEntry {
  role: "agent" | "caller";
  text: string;
}

interface CallData {
  call_id: string;
  caller_name?: string;
  phone_number?: string;
  direction?: "inbound" | "outbound";
  status?: string;
  timestamp?: string;
  duration_seconds?: number;
  summary?: string;
  transcript?: TranscriptEntry[];
  [key: string]: any; // fallback for any extra fields
}

interface CallDrawerProps {
  open: boolean;
  call: CallData | null;
  loading: boolean;
  onClose: () => void;
}

export default function CallDrawer({
  open,
  call,
  loading,
  onClose,
}: CallDrawerProps) {
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity z-40"
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        className={`
          fixed top-0 right-0 h-full w-[550px] bg-white shadow-xl z-50
          transform transition-transform duration-300
          ${open ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">Call Details</h2>

          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 transition"
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto h-full">
          {loading && <p>Loading call…</p>}

          {!loading && !call && (
            <p className="text-gray-500">Call not found.</p>
          )}

          {!loading && call && (
            <div className="space-y-6">
              {/* Call Header */}
              <CallHeader
                callerName={call.caller_name}
                phoneNumber={call.phone_number}
                direction={call.direction}
                status={call.status}
                startedAt={call.timestamp}
                durationSeconds={call.duration_seconds}
              />

              {/* Status */}
              <div>
                <h3 className="text-lg font-medium mb-1">Status</h3>
                <StatusBadge status={call.status || "unknown"} />
              </div>

              {/* Summary */}
              {call.summary && (
                <div>
                  <h3 className="text-lg font-medium mb-1">Summary</h3>
                  <p className="text-gray-700 whitespace-pre-line">
                    {call.summary}
                  </p>
                </div>
              )}

              {/* Transcript */}
              {Array.isArray(call.transcript) && call.transcript.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-2">Transcript</h3>

                  <div className="space-y-3">
                    {call.transcript.map((entry, index) => (
                      <div
                        key={index}
                        className="p-3 rounded-md border bg-gray-50"
                      >
                        <p className="text-sm text-gray-500 mb-1">
                          {entry.role === "agent" ? "Agent" : "Caller"}
                        </p>
                        <p className="text-gray-800 whitespace-pre-line">
                          {entry.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw JSON */}
              <div>
                <h3 className="text-lg font-medium mb-1">Raw Data</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-md text-sm overflow-x-auto">
                  {JSON.stringify(call, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}