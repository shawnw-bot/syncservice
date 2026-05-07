import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-gray-900">

      {/* ✅ HERO SECTION */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          SyncService
        </h1>

        <p className="mt-4 text-lg text-gray-600">
          The AI Communication Engine for Service Shops
        </p>

        <p className="mt-4 text-base text-gray-500 max-w-2xl mx-auto">
          Automate customer updates, streamline advisor workflows, and eliminate
          phone tag — all in one place.
        </p>

        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/signup"
            className="px-6 py-3 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition"
          >
            Start 7‑Day Free Trial
          </Link>

          <Link
            href="/login"
            className="px-6 py-3 border rounded-lg text-sm font-medium hover:bg-gray-100 transition"
          >
            Log In
          </Link>
        </div>
      </section>

      {/* ✅ ABOUT SECTION */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-4xl mx-auto px-6 space-y-6 text-center">
          <h2 className="text-2xl font-semibold">
            What is SyncService?
          </h2>

          <p className="text-gray-600 text-sm leading-relaxed">
            SyncService is an AI-powered communication engine built specifically
            for automotive service shops, dealerships, and repair centers. It
            replaces manual phone calls and guesswork with automated customer
            approvals, real-time job status updates, and AI-driven phone calls,
            so your advisors spend less time on hold and more time delivering
            great service.
          </p>
        </div>
      </section>

      {/* ✅ PRICING */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-semibold">
            Simple, Transparent Pricing
          </h2>

          <p className="text-sm text-gray-500 mt-2">
            Every plan includes a 7‑day free trial. No credit card required.
          </p>

          <div className="grid md:grid-cols-3 gap-6 mt-10">

            {/* Starter */}
            <div className="border rounded-lg p-6">
              <h3 className="font-medium text-lg">Starter</h3>
              <p className="mt-2 text-2xl font-semibold">$199/mo</p>

              <ul className="mt-4 text-sm text-gray-600 space-y-2">
                <li>✓ Up to 50 AI calls/month</li>
                <li>✓ SMS & email notifications</li>
                <li>✓ Customer approval workflow</li>
                <li>✓ Job completion notifications</li>
              </ul>

              <button className="mt-6 w-full px-4 py-2 bg-black text-white rounded text-sm hover:bg-gray-800">
                Start Trial
              </button>
            </div>

            {/* Pro */}
            <div className="border-2 border-black rounded-lg p-6">
              <h3 className="font-medium text-lg">Pro</h3>
              <p className="mt-2 text-2xl font-semibold">$399/mo</p>

              <ul className="mt-4 text-sm text-gray-600 space-y-2">
                <li>✓ Up to 200 AI calls/month</li>
                <li>✓ SMS, email & AI calls</li>
                <li>✓ Multi-advisor support</li>
                <li>✓ Customer broadcasts</li>
              </ul>

              <button className="mt-6 w-full px-4 py-2 bg-black text-white rounded text-sm hover:bg-gray-800">
                Start Trial
              </button>
            </div>

            {/* Enterprise */}
            <div className="border rounded-lg p-6">
              <h3 className="font-medium text-lg">Enterprise</h3>
              <p className="mt-2 text-2xl font-semibold">$699/mo</p>

              <ul className="mt-4 text-sm text-gray-600 space-y-2">
                <li>✓ Unlimited AI calls</li>
                <li>✓ Multi-location support</li>
                <li>✓ Custom AI workflows</li>
                <li>✓ Dedicated support</li>
              </ul>

              <button className="mt-6 w-full px-4 py-2 bg-black text-white rounded text-sm hover:bg-gray-800">
                Start Trial
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* ✅ CTA FOOTER */}
      <section className="bg-black text-white py-16 text-center">
        <h2 className="text-2xl font-semibold">
          Start Your 7‑Day Free Trial
        </h2>

        <p className="text-sm text-gray-300 mt-2">
          No credit card required. Full access from day one.
        </p>

        <Link
          href="/signup"
          className="inline-block mt-6 px-6 py-3 bg-white text-black rounded text-sm font-medium hover:bg-gray-200"
        >
          Start Trial
        </Link>
      </section>

      {/* ✅ FOOTER */}
      <footer className="text-center text-xs text-gray-500 py-6">
        © 2026 The Business Mechanic
      </footer>

    </main>
  );
}