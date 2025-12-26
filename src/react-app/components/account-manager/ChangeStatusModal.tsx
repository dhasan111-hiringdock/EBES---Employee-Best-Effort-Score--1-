import { useState } from "react";
import { X } from "lucide-react";
import { fetchWithAuth } from "@/react-app/utils/api";

interface Role {
  id: number;
  role_code: string;
  title: string;
  status: string;
}

interface ChangeStatusModalProps {
  role: Role;
  onClose: () => void;
  onStatusChanged: () => void;
}

const statuses = [
  { value: "active", label: "Active", color: "bg-green-100 text-green-700" },
  { value: "lost", label: "Lost", color: "bg-red-100 text-red-700" },
  { value: "deal", label: "Deal", color: "bg-blue-100 text-blue-700" },
  { value: "on_hold", label: "On Hold", color: "bg-yellow-100 text-yellow-700" },
  { value: "cancelled", label: "Cancelled", color: "bg-gray-100 text-gray-700" },
  { value: "no_answer", label: "No Answer", color: "bg-purple-100 text-purple-700" },
];

export default function ChangeStatusModal({ role, onClose, onStatusChanged }: ChangeStatusModalProps) {
  const [selectedStatus, setSelectedStatus] = useState(role.status);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedStatus === role.status) {
      onClose();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth(`/api/am/roles/${role.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: selectedStatus }),
      });

      if (response.ok) {
        onStatusChanged();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to update status");
      }
    } catch (err) {
      setError("An error occurred while updating the status");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Change Status</h3>
            <p className="text-sm text-gray-600 mt-1">{role.title}</p>
            <p className="text-xs text-gray-500 font-mono mt-0.5">{role.role_code}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            {statuses.map((status) => (
              <button
                key={status.value}
                type="button"
                onClick={() => setSelectedStatus(status.value)}
                className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                  selectedStatus === status.value
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{status.label}</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.color}`}>
                    {status.label}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || selectedStatus === role.status}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {loading ? "Updating..." : "Update Status"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
