"use client";

import { useState } from "react";

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function StartTrialPage() {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [shopForm, setShopForm] = useState({
    shopName: "",
    shopPhone: "",
    shopAddress: "",
  });

  const [ownerForm, setOwnerForm] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const [error, setError] = useState("");

  const shopValid =
    shopForm.shopName.length > 1 && shopForm.shopAddress.length > 4;

  const ownerValid =
    ownerForm.name.length > 1 && ownerForm.email.includes("@");

  async function handleSubmit() {
    if (!ownerValid) return;

    setSaving(true);

    // ✅ TEMP — simulate success
    setTimeout(() => {
      setSaving(false);
      setStep(3);
    }, 1200);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-2xl font-bold">SyncService</div>
          <div className="text-sm text-gray-600">
            Start your free 7‑day trial
          </div>
        </div>

        <div className="bg-white border rounded-xl p-8 shadow-sm">

          {/* Progress */}
          <div className="flex gap-2 mb-6">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded ${
                  step >= s ? "bg-blue-600" : "bg-gray-200"
                }`}
              />
            ))}
          </div>

          {/* STEP 1 */}
          {step === 1 && (
            <>
              <h2 className="text-lg font-semibold">Your Shop</h2>
              <p className="text-sm text-gray-500 mb-4">
                Tell us about your auto shop to get started.
              </p>

              <input
                placeholder="Shop Name"
                className="w-full border rounded p-3 mb-3"
                value={shopForm.shopName}
                onChange={(e) =>
                  setShopForm({ ...shopForm, shopName: e.target.value })
                }
              />

              <input
                placeholder="(555) 123-4567"
                className="w-full border rounded p-3 mb-3"
                value={shopForm.shopPhone}
                onChange={(e) =>
                  setShopForm({
                    ...shopForm,
                    shopPhone: formatPhone(e.target.value),
                  })
                }
              />

              <textarea
                placeholder="Shop Address"
                className="w-full border rounded p-3 mb-4"
                value={shopForm.shopAddress}
                onChange={(e) =>
                  setShopForm({ ...shopForm, shopAddress: e.target.value })
                }
              />

              <button
                className="w-full bg-blue-600 text-white py-3 rounded"
                disabled={!shopValid}
                onClick={() => setStep(2)}
              >
                Continue →
              </button>
            </>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <>
              <h2 className="text-lg font-semibold">Shop Owner</h2>
              <p className="text-sm text-gray-500 mb-4">
                Who will manage this account?
              </p>

              <input
                placeholder="Full Name"
                className="w-full border rounded p-3 mb-3"
                value={ownerForm.name}
                onChange={(e) =>
                  setOwnerForm({ ...ownerForm, name: e.target.value })
                }
              />

              <input
                placeholder="Email"
                className="w-full border rounded p-3 mb-3"
                value={ownerForm.email}
                onChange={(e) =>
                  setOwnerForm({ ...ownerForm, email: e.target.value })
                }
              />

              <input
                placeholder="Phone"
                className="w-full border rounded p-3 mb-3"
                value={ownerForm.phone}
                onChange={(e) =>
                  setOwnerForm({
                    ...ownerForm,
                    phone: formatPhone(e.target.value),
                  })
                }
              />

              {error && (
                <div className="text-red-500 text-sm mb-3">
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  className="border px-4 py-2 rounded"
                  onClick={() => setStep(1)}
                >
                  Back
                </button>

                <button
                  className="flex-1 bg-black text-white py-2 rounded"
                  disabled={!ownerValid || saving}
                  onClick={handleSubmit}
                >
                  {saving ? "Sending..." : "Send Setup Link →"}
                </button>
              </div>
            </>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="text-center">
              <div className="text-4xl mb-3">🎉</div>

              <h2 className="text-lg font-semibold mb-2">
                Check Your Email!
              </h2>

              <p className="text-sm text-gray-500">
                We sent a setup link to {ownerForm.email}
              </p>

              <div className="bg-green-100 mt-4 p-3 rounded text-sm">
                ✅ Trial Active — 7 days
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}