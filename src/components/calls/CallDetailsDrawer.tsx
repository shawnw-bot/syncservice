interface CallDetailsDrawerProps {
  call: any;
  onClose: () => void;
}

export default function CallDetailsDrawer({ call, onClose }: CallDetailsDrawerProps) {
  return (
    <div className="fixed inset-0 flex justify-end z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-96 h-full bg-white shadow-xl p-6 animate-slideIn">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>

        <h2 className="text-2xl font-bold mb-4">Call Details</h2>

        <div className="mb-6">
          <p className="text-sm text-gray-600">Caller</p>
          <p className="text-lg font-semibold">{call.callerName}</p>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-600">Timestamp</p>
          <p className="text-lg font-semibold">{call.timestamp}</p>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-600">Status</p>
          <p className="text-lg font-semibold">{call.status}</p>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-600">Duration</p>
          <p className="text-lg font-semibold">{call.duration}</p>
        </div>

        <hr className="my-6" />

        <h3 className="text-xl font-semibold mb-2">Transcript</h3>
        <p className="text-gray-700 text-sm mb-6">
          “Hi, this is a sample transcript. The real transcript will come from AWS
          once we connect your backend. This is just placeholder text so you can
          see the layout.”
        </p>

        <h3 className="text-xl font-semibold mb-2">AI Summary</h3>
        <p className="text-gray-700 text-sm">
          • Customer called about a service issue  
          • Requested appointment availability  
          • Follow‑up recommended  
        </p>
      </div>
    </div>
  );
}