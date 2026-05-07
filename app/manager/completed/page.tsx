type CompletedSync = {
  external_id: string;
  status: string;
  resolved_at?: string;
  resolved_reason?: string;
};

async function fetchCompletedSyncs(): Promise<CompletedSync[]> {
  const res = await fetch(
    "http://localhost:3000/api/sync/completed",
    { cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error("Failed to fetch completed Sync records");
  }

  const data = await res.json();
  return data.items ?? [];
}

export default async function ManagerCompletedPage() {
  const completed = await fetchCompletedSyncs();

  return (
    <main style={{ padding: "24px" }}>
      <h1>Completed Repair Orders</h1>

      <p style={{ color: "#666", marginBottom: "16px" }}>
        Manager view — completed and archived ROs.
      </p>

      {completed.length === 0 ? (
        <p>No completed ROs found.</p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: "12px",
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #ccc",
                  paddingBottom: "8px",
                }}
              >
                External ID
              </th>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #ccc",
                  paddingBottom: "8px",
                }}
              >
                Completed At
              </th>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #ccc",
                  paddingBottom: "8px",
                }}
              >
                Completion Reason
              </th>
            </tr>
          </thead>
          <tbody>
            {completed.map((sync) => (
              <tr key={sync.external_id}>
                <td style={{ padding: "8px 0" }}>
                  <a
                    href={`/sync/${sync.external_id}`}
                    style={{ textDecoration: "underline", color: "#0070f3" }}
                  >
                    {sync.external_id}
                  </a>
                </td>
                <td style={{ padding: "8px 0" }}>
                  {sync.resolved_at
                    ? new Date(sync.resolved_at).toLocaleString()
                    : "—"}
                </td>
                <td style={{ padding: "8px 0" }}>
                  {sync.resolved_reason ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}