"use client";

type CallCardProps = {
  call: any;
  summaryText?: string;
};

export default function CallCard({ call, summaryText }: CallCardProps) {
  // Defensive rendering helpers
  const safeText = (value: any) => {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number") return value.toString();
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    return String(value);
  };

  return (
    <div className="border rounded p-4 bg-white shadow-sm">
      <div className="flex justify-between items-center mb-2">
        <div className="font-medium">
          Call ID: {safeText(call.call_id || call.id)}
        </div>
        <div className="text-sm text-gray-500">
          {safeText(call.status)}
        </div>
      </div>

      {summaryText && (
        <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-2 rounded">
          {summaryText}
        </pre>
      )}
    </div>
  );
}
