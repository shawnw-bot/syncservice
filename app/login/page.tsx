"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  function handleLogin() {
    if (!email.trim()) return;

    setLoading(true);

    // ✅ Simulate login
    setTimeout(() => {
      router.push("/dashboard");
    }, 500);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-white px-6">
      <div className="w-full max-w-md border rounded-xl p-8 space-y-6 shadow-sm">

        {/* ✅ HEADER */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold">
            Log In to SyncService
          </h1>

          <p className="text-sm text-gray-600">
            Enter your email to access your dashboard
          </p>
        </div>

        {/* ✅ FORM */}
        <div className="space-y-4">

          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-black"
          />

          <button
            onClick={handleLogin}
            disabled={loading || !email.trim()}
            className={[
              "w-full py-2 rounded text-sm font-medium text-white transition",
              loading || !email.trim()
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-black hover:bg-gray-800",
            ].join(" ")}
          >
            {loading ? "Logging in..." : "Log In"}
          </button>

        </div>

        {/* ✅ NAV BACK */}
        <div className="text-center">
          <button
            onClick={() => router.push("/")}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back to Home
          </button>
        </div>

      </div>
    </main>
  );
}