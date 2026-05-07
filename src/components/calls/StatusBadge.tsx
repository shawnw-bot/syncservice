interface StatusBadgeProps {
  status: string;
}

const statusStyles: Record<string, string> = {
  Completed: "bg-green-100 text-green-700",
  Missed: "bg-red-100 text-red-700",
  Voicemail: "bg-yellow-100 text-yellow-700",
  "In Progress": "bg-blue-100 text-blue-700",
  Transferred: "bg-purple-100 text-purple-700",
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const style = statusStyles[status] || "bg-gray-100 text-gray-700";

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded ${style}`}>
      {status}
    </span>
  );
}