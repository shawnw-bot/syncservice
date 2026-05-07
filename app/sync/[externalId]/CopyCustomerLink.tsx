"use client";

import { useMemo, useState } from "react";

export default function CopyCustomerLink({ externalId }: { externalId: string }) {
  const [copied, setCopied] = useState(false);

  const link = useMemo(() => {
    // Uses whatever domain you're currently on (localhost or production)
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/track/${encodeURIComponent(externalId)}`;
  }, [externalId]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // fallback for older browsers
      try {
        const ta = document.createElement("textarea");
        ta.value = link;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      } catch {
        // no-op (button will still show link for manual copy)
      }
    }
  }

  return (
    <section className="rounded-lg border bg-white p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-900">
            Customer Tracking Link
          </div>
          <div className="text-xs text-gray-600">
            Share this link with the customer so they can check ticket status anytime.
          </div>
        </div>

        <button
          onClick={copy}
          className="px-3 py-2 rounded bg-black text-white text-sm hover:bg-gray-800 whitespace-nowrap"
        >
          {copied ? "Copied!" : "Copy Link"}
        </button>
      </div>

      <input
        readOnly
        value={link}
        className="w-full rounded-lg border px-3 py-2 text-sm text-gray-700 bg-gray-50"
      />
    </section>
  );
}