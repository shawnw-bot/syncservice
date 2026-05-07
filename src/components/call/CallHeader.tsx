import React from "react";

type CallDirection = "inbound" | "outbound";
type CallStatus = "completed" | "missed" | "voicemail" | "unknown";

interface CallHeaderProps {
  callerName?: string;
  phoneNumber?: string;
  direction?: CallDirection;
  status?: CallStatus;
  startedAt?: string;
  durationSeconds?: number;
}

function formatDuration(seconds?: number) {
  if (!seconds) return "0m 00s";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

const CallHeader: React.FC<CallHeaderProps> = ({
  callerName,
  phoneNumber,
  direction,
  status,
  startedAt,
  durationSeconds,
}) => {
  return (
    <div className="border-b border-gray-200 pb-4 mb-4">
      <h2 className="text-xl font-semibold text-gray-900">
        {callerName || "Unknown Caller"}
      </h2>

      <div className="mt-1 text-sm text-gray-600">
        {phoneNumber || "Unknown Number"} •{" "}
        {direction ? (direction === "inbound" ? "Inbound" : "Outbound") : "Unknown Direction"}
      </div>

      <div className="mt-1 text-sm text-gray-500">
        Status: {status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown"}
      </div>

      <div className="mt-1 text-xs text-gray-400">
        {startedAt || "Unknown Time"} • Duration: {formatDuration(durationSeconds)}
      </div>
    </div>
  );
};

export default CallHeader;