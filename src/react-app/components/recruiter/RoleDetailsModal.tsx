import { X, Building2, Users, User, Calendar, Send, TrendingUp, UserX, CheckCircle } from "lucide-react";

interface Role {
  id: number;
  role_code: string;
  title: string;
  description: string;
  client_name: string;
  team_name: string;
  account_manager_name: string;
  status: string;
  created_at: string;
  total_submissions: number;
  total_interviews: number;
  total_deals: number;
  total_candidates: number;
  active_candidates: number;
  discarded_candidates: number;
  in_play_submissions: number;
}

interface RoleDetailsModalProps {
  role: Role | null;
  onClose: () => void;
}

export default function RoleDetailsModal({ role, onClose }: RoleDetailsModalProps) {
  if (!role) return null;

  const getStatusConfig = (status: string) => {
    const configs: { [key: string]: { color: string; bg: string; label: string } } = {
      open: { color: 'text-green-700', bg: 'bg-green-50 border-green-200', label: 'Open' },
      closed: { color: 'text-red-700', bg: 'bg-red-50 border-red-200', label: 'Closed' },
      'on hold': { color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', label: 'On Hold' },
      active: { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', label: 'Active' },
      deal: { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', label: 'Deal Closed' },
      lost: { color: 'text-red-700', bg: 'bg-red-50 border-red-200', label: 'Lost' },
      on_hold: { color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', label: 'On Hold' },
      no_answer: { color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', label: 'No Answer' },
    };
    return configs[status] || configs.open;
  };

  const statusConfig = getStatusConfig(role.status);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Modal Header */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-indigo-700 px-8 py-6 flex items-center justify-between text-white z-10">
          <div>
            <h3 className="text-2xl font-bold">Role Details</h3>
            <p className="text-indigo-100 text-sm mt-1 font-mono">{role.role_code}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {/* Modal Body */}
        <div className="p-8 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="space-y-6">
            {/* Status Badge */}
            <div>
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border ${statusConfig.color} ${statusConfig.bg}`}>
                <CheckCircle className="w-5 h-5" />
                <span className="font-semibold">{statusConfig.label}</span>
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Title</label>
              <p className="text-2xl font-bold text-slate-800 mt-2">{role.title}</p>
            </div>

            {/* Description */}
            {role.description && (
              <div>
                <label className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Description</label>
                <p className="text-slate-700 mt-2 leading-relaxed">{role.description}</p>
              </div>
            )}

            {/* Submissions in Play */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 border-2 border-indigo-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-indigo-100 rounded-lg p-2">
                  <Send className="w-6 h-6 text-indigo-600" />
                </div>
                <label className="text-lg font-semibold text-indigo-900">Submissions in Play</label>
              </div>
              <p className="text-5xl font-bold text-indigo-600">{role.in_play_submissions || 0}</p>
              <p className="text-sm text-indigo-700 mt-2">Active candidates being tracked</p>
            </div>

            {/* Statistics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <div className="bg-blue-100 rounded-lg p-2">
                    <Send className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-blue-600">{role.total_submissions || 0}</p>
                <p className="text-xs text-slate-600 mt-1 font-medium">Total Submissions</p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <div className="bg-purple-100 rounded-lg p-2">
                    <Users className="w-5 h-5 text-purple-600" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-purple-600">{role.total_interviews || 0}</p>
                <p className="text-xs text-slate-600 mt-1 font-medium">Interviews</p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <div className="bg-emerald-100 rounded-lg p-2">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-emerald-600">{role.total_deals || 0}</p>
                <p className="text-xs text-slate-600 mt-1 font-medium">Deals</p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <div className="bg-indigo-100 rounded-lg p-2">
                    <Users className="w-5 h-5 text-indigo-600" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-indigo-600">{role.total_candidates || 0}</p>
                <p className="text-xs text-slate-600 mt-1 font-medium">Total Candidates</p>
              </div>
            </div>

            {/* Candidate Status */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-2xl p-5 border border-green-200">
                <div className="flex items-center gap-2 mb-3">
                  <div className="bg-green-100 rounded-lg p-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <label className="text-sm font-semibold text-slate-600">Active Candidates</label>
                </div>
                <p className="text-3xl font-bold text-green-600">{role.active_candidates || 0}</p>
                <p className="text-xs text-slate-500 mt-1">Still in process</p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-5 border border-red-200">
                <div className="flex items-center gap-2 mb-3">
                  <div className="bg-red-100 rounded-lg p-2">
                    <UserX className="w-5 h-5 text-red-600" />
                  </div>
                  <label className="text-sm font-semibold text-slate-600">Discarded</label>
                </div>
                <p className="text-3xl font-bold text-red-600">{role.discarded_candidates || 0}</p>
                <p className="text-xs text-slate-500 mt-1">Not suitable</p>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-indigo-100 rounded-lg p-2">
                    <Building2 className="w-5 h-5 text-indigo-600" />
                  </div>
                  <label className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Client</label>
                </div>
                <p className="text-lg font-bold text-slate-800">{role.client_name}</p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-emerald-100 rounded-lg p-2">
                    <Users className="w-5 h-5 text-emerald-600" />
                  </div>
                  <label className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Team</label>
                </div>
                <p className="text-lg font-bold text-slate-800">{role.team_name}</p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 md:col-span-2">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-blue-100 rounded-lg p-2">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <label className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Account Manager</label>
                </div>
                <p className="text-lg font-bold text-slate-800">{role.account_manager_name}</p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 md:col-span-2">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-purple-100 rounded-lg p-2">
                    <Calendar className="w-5 h-5 text-purple-600" />
                  </div>
                  <label className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Created Date</label>
                </div>
                <p className="text-lg font-bold text-slate-800">
                  {new Date(role.created_at).toLocaleDateString('en-US', { 
                    weekday: 'long',
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-8 py-4">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
