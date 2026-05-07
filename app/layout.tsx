// app/layout.tsx
import "./globals.css";
import Link from "next/link";
import { useAuth } from "@/src/lib/useAuth";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated } = useAuth();

  return (
    <html lang="en">
      <body className="h-screen flex bg-gray-100 text-gray-900 antialiased">
        {/* Sidebar */}
        <aside className="w-56 bg-white border-r flex flex-col">
          <div className="px-4 py-4 font-semibold text-lg border-b">
            SyncService
          </div>

          <nav className="flex-1 px-2 py-3 space-y-1 text-sm">
            <NavLink href="/sync">Sync</NavLink>
            <NavLink href="/action-required">Action Required</NavLink>
            <NavLink href="/calls">Calls</NavLink>
            <NavLink href="/manager">Manager</NavLink>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <header className="h-14 bg-white border-b flex items-center justify-between px-6 text-sm">
            <div className="text-gray-500">
              {/* Reserved for future breadcrumbs or page context */}
            </div>

            {isAuthenticated && (
              <div className="text-sm text-gray-700">
                Logged in as{" "}
                <span className="font-medium text-gray-900">
                  {user.name}
                </span>{" "}
                <span className="text-gray-500">
                  ({user.role})
                </span>
              </div>
            )}
          </header>

          <section className="p-6 max-w-7xl">
            {children}
          </section>
        </main>
      </body>
    </html>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition"
    >
      {children}
    </Link>
  );
}