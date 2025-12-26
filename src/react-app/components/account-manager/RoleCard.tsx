import { Edit, Trash2, RefreshCw, Plus } from "lucide-react";

interface Role {
  id: number;
  role_code: string;
  title: string;
  description: string;
  status: string;
  client_name: string;
  team_name: string;
  interview_1_count: number;
  interview_2_count: number;
  interview_3_count: number;
  total_interviews: number;
  total_submissions: number;
  has_pending_dropout?: boolean;
  pending_dropout_reason?: string;
  has_dropout?: boolean;
  dropout_decision?: string;
}

interface RoleCardProps {
  role: Role;
  onEdit: () => void;
  onDelete: () => void;
  onChangeStatus: () => void;
  onAddInterview: () => void;
}

export default function RoleCard({
  role,
  onEdit,
  onDelete,
  onChangeStatus,
  onAddInterview,
}: RoleCardProps) {
  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-700 border-green-200",
    lost: "bg-red-100 text-red-700 border-red-200",
    deal: "bg-blue-100 text-blue-700 border-blue-200",
    on_hold: "bg-yellow-100 text-yellow-700 border-yellow-200",
    cancelled: "bg-gray-100 text-gray-700 border-gray-200",
    no_answer: "bg-purple-100 text-purple-700 border-purple-200",
  };

  const statusLabels: Record<string, string> = {
    active: "Active",
    lost: "Lost",
    deal: "Deal",
    on_hold: "On Hold",
    cancelled: "Cancelled",
    no_answer: "No Answer",
  };

  return (
    <div className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 truncate">{role.title}</h3>
            {role.has_pending_dropout && (
              <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-semibold rounded border border-orange-200">
                Pending
              </span>
            )}
            {role.has_dropout && (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded border border-red-200">
                Dropped Out
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600 font-mono">{role.role_code}</p>
        </div>
        <div className={`px-3 py-1 rounded-full border text-xs font-medium ${statusColors[role.status]}`}>
          {statusLabels[role.status]}
        </div>
      </div>

      {role.description && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{role.description}</p>
      )}

      <div className="bg-indigo-50 rounded-lg p-3 mb-3 border border-indigo-100">
        <p className="text-xs text-indigo-700 mb-1 font-semibold">Submissions</p>
        <p className="text-2xl font-bold text-indigo-600">{role.total_submissions}</p>
      </div>

      <div className="bg-gray-50 rounded-lg p-3 mb-3">
        <p className="text-xs text-gray-600 mb-2 font-medium">Interview Progress</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-lg font-bold text-indigo-600">{role.interview_1_count}</p>
            <p className="text-xs text-gray-500">1st Round</p>
          </div>
          <div>
            <p className="text-lg font-bold text-indigo-600">{role.interview_2_count}</p>
            <p className="text-xs text-gray-500">2nd Round</p>
          </div>
          <div>
            <p className="text-lg font-bold text-indigo-600">{role.interview_3_count}</p>
            <p className="text-xs text-gray-500">Final</p>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-gray-200">
          <p className="text-xs text-gray-600 text-center">
            Total Interviews: <span className="font-bold text-gray-900">{role.total_interviews}</span>
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          title="Edit role"
        >
          <Edit className="w-3 h-3" />
          Edit
        </button>
        <button
          onClick={onChangeStatus}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          title="Change status"
        >
          <RefreshCw className="w-3 h-3" />
          Status
        </button>
        <button
          onClick={onAddInterview}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          title="Add interview entry"
        >
          <Plus className="w-3 h-3" />
          Entry
        </button>
        <button
          onClick={onDelete}
          className="px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          title="Delete role"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
