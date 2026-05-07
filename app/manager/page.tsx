import Link from "next/link";

export default function ManagerPage() {
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-bold">Manager</h1>

      <p className="text-gray-600">
        Manager dashboard entry point.
      </p>

      <div className="flex flex-col space-y-2 text-sm">
        <Link
          href="/manager/completed"
          className="text-blue-600 hover:underline"
        >
          Completed Repair Orders
        </Link>
      </div>
    </main>
  );
}