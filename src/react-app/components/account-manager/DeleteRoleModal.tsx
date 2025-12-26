import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";

interface Role {
  id: number;
  role_code: string;
  title: string;
}

interface DeleteRoleModalProps {
  role: Role;
  onClose: () => void;
  onRoleDeleted: () => void;
}

export default function DeleteRoleModal({ role, onClose, onRoleDeleted }: DeleteRoleModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/am/roles/${role.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        onRoleDeleted();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to delete role");
      }
    } catch (err) {
      setError("An error occurred while deleting the role");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-gray-900">Delete Role</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-900 mb-1">Are you sure?</p>
              <p className="text-sm text-red-700">
                You are about to delete <strong>{role.title}</strong> ({role.role_code}). This
                action cannot be undone and will remove all associated interview data.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {loading ? "Deleting..." : "Delete Role"}
          </button>
        </div>
      </div>
    </div>
  );
}
