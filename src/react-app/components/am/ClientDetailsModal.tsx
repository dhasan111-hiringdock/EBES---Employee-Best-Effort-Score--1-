import { X, Briefcase, TrendingUp, Users, CheckCircle, XCircle, Clock, AlertCircle, BarChart } from "lucide-react";

interface ClientDetailsModalProps {
  client: {
    client_id: number;
    client_name: string;
    client_code: string;
    total_roles: number;
    active_roles: number;
    interview_1: number;
    interview_2: number;
    deals: number;
    lost: number;
    on_hold: number;
    no_answer: number;
    cancelled?: number;
    health: string;
  };
  onClose: () => void;
}

export default function ClientDetailsModal({ client, onClose }: ClientDetailsModalProps) {
  const getHealthColor = (health: string) => {
    switch (health) {
      case "Strong":
        return "from-green-500 to-green-600";
      case "Average":
        return "from-yellow-500 to-yellow-600";
      case "At Risk":
        return "from-red-500 to-red-600";
      default:
        return "from-gray-500 to-gray-600";
    }
  };

  const totalInterviews = client.interview_1 + client.interview_2;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className={`sticky top-0 bg-gradient-to-r ${getHealthColor(client.health)} px-6 py-5 flex justify-between items-center rounded-t-2xl`}>
          <div>
            <h3 className="text-2xl font-bold text-white">{client.client_name}</h3>
            <p className="text-sm text-white text-opacity-90 mt-1 font-mono">{client.client_code}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Health Status */}
          <div className={`p-6 bg-gradient-to-br ${
            client.health === "Strong" ? "from-green-50 to-green-100 border-green-200" :
            client.health === "Average" ? "from-yellow-50 to-yellow-100 border-yellow-200" :
            "from-red-50 to-red-100 border-red-200"
          } rounded-lg border-2`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Client Health Status</p>
                <p className={`text-3xl font-bold ${
                  client.health === "Strong" ? "text-green-700" :
                  client.health === "Average" ? "text-yellow-700" :
                  "text-red-700"
                }`}>
                  {client.health}
                </p>
              </div>
              <div className="text-5xl">
                {client.health === "Strong" && "💪"}
                {client.health === "Average" && "📊"}
                {client.health === "At Risk" && "⚠️"}
              </div>
            </div>
          </div>

          {/* Overview Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-4 border border-indigo-200">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="w-5 h-5 text-indigo-600" />
                <p className="text-xs font-semibold text-indigo-900">Total Roles</p>
              </div>
              <p className="text-3xl font-bold text-indigo-700">{client.total_roles}</p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <p className="text-xs font-semibold text-blue-900">Active</p>
              </div>
              <p className="text-3xl font-bold text-blue-700">{client.active_roles}</p>
            </div>

            <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-lg p-4 border border-teal-200">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-teal-600" />
                <p className="text-xs font-semibold text-teal-900">Interviews</p>
              </div>
              <p className="text-3xl font-bold text-teal-700">{totalInterviews}</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="text-xs font-semibold text-green-900">Deals</p>
              </div>
              <p className="text-3xl font-bold text-green-700">{client.deals}</p>
            </div>
          </div>

          {/* Interview Breakdown */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <BarChart className="w-5 h-5 text-slate-600" />
              Interview Breakdown
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-white rounded-lg border border-slate-200">
                <p className="text-xs text-slate-600 mb-1">Level 1</p>
                <p className="text-2xl font-bold text-teal-600">{client.interview_1}</p>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border border-slate-200">
                <p className="text-xs text-slate-600 mb-1">Level 2</p>
                <p className="text-2xl font-bold text-blue-600">{client.interview_2}</p>
              </div>
            </div>
          </div>

          {/* Role Status Details */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <h4 className="font-semibold text-slate-800 mb-4">Role Status Breakdown</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <p className="text-xs font-medium text-slate-700">Deals</p>
                </div>
                <p className="text-xl font-bold text-green-600">{client.deals}</p>
              </div>

              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <div className="flex items-center gap-2 mb-1">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <p className="text-xs font-medium text-slate-700">Lost</p>
                </div>
                <p className="text-xl font-bold text-red-600">{client.lost}</p>
              </div>

              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-yellow-600" />
                  <p className="text-xs font-medium text-slate-700">On Hold</p>
                </div>
                <p className="text-xl font-bold text-yellow-600">{client.on_hold}</p>
              </div>

              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-4 h-4 text-orange-600" />
                  <p className="text-xs font-medium text-slate-700">No Answer</p>
                </div>
                <p className="text-xl font-bold text-orange-600">{client.no_answer}</p>
              </div>

              {client.cancelled !== undefined && (
                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <div className="flex items-center gap-2 mb-1">
                    <XCircle className="w-4 h-4 text-gray-600" />
                    <p className="text-xs font-medium text-slate-700">Cancelled</p>
                  </div>
                  <p className="text-xl font-bold text-gray-600">{client.cancelled}</p>
                </div>
              )}
            </div>
          </div>

          {/* Performance Insights */}
          <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
            <h4 className="font-semibold text-indigo-900 mb-3">Performance Insights</h4>
            <div className="space-y-2 text-sm text-indigo-800">
              {client.deals > 0 && (
                <p>✓ Successfully closed {client.deals} {client.deals === 1 ? 'deal' : 'deals'}</p>
              )}
              {client.active_roles > 0 && (
                <p>• Currently managing {client.active_roles} active {client.active_roles === 1 ? 'role' : 'roles'}</p>
              )}
              {totalInterviews > 0 && (
                <p>• Conducted {totalInterviews} {totalInterviews === 1 ? 'interview' : 'interviews'} across all levels</p>
              )}
              {client.lost > 0 && (
                <p className="text-red-700">⚠ {client.lost} {client.lost === 1 ? 'role' : 'roles'} marked as lost</p>
              )}
              {client.no_answer > 0 && (
                <p className="text-orange-700">⚠ {client.no_answer} {client.no_answer === 1 ? 'role' : 'roles'} with no answer</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
