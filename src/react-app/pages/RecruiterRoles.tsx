import { useState, useEffect } from "react";
import { Briefcase, Search, CheckCircle, XCircle, Users, TrendingUp, UserX, Send } from "lucide-react";
import { fetchWithAuth } from "@/react-app/utils/api";
import RoleDetailsModal from "@/react-app/components/recruiter/RoleDetailsModal";

interface Role {
  id: number;
  role_code: string;
  title: string;
  description: string;
  client_name: string;
  team_name: string;
  account_manager_name: string;
  status: string;
  is_active: number;
  total_submissions: number;
  total_candidates: number;
  active_candidates: number;
  discarded_candidates: number;
  total_interviews: number;
  total_deals: number;
  in_play_submissions: number;
  created_at: string;
}

export default function RecruiterRoles() {
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredRole, setHoveredRole] = useState<number | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  useEffect(() => {
    fetchRoles();
  }, [activeTab, searchQuery]);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const isActive = activeTab === 'active' ? '1' : '0';
      const searchParam = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : '';
      const response = await fetchWithAuth(`/api/recruiter/roles-list?is_active=${isActive}${searchParam}`);
      
      if (response.ok) {
        const data = await response.json();
        setRoles(data);
      }
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'open':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'closed':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'on hold':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Roles</h2>
          <p className="text-slate-500 mt-1">View all roles and their submission statistics</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-6 py-2 rounded-md font-medium transition-all ${
            activeTab === 'active'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Active Roles
          </div>
        </button>
        <button
          onClick={() => setActiveTab('inactive')}
          className={`px-6 py-2 rounded-md font-medium transition-all ${
            activeTab === 'inactive'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            Inactive Roles
          </div>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search roles by title or code..."
            className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Roles List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : roles.length === 0 ? (
          <div className="text-center py-12">
            <Briefcase className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">
              {searchQuery
                ? `No roles found for "${searchQuery}"`
                : `No ${activeTab} roles`}
            </p>
            <p className="text-sm text-slate-500 mt-2">
              {searchQuery ? 'Try a different search term' : 'Roles will appear here when available'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {roles.map((role) => (
              <div
                key={role.id}
                className="p-4 hover:bg-slate-50 transition-colors relative cursor-pointer"
                onMouseEnter={() => setHoveredRole(role.id)}
                onMouseLeave={() => setHoveredRole(null)}
                onClick={() => setSelectedRole(role)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center text-white">
                        <Briefcase className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-800">{role.title}</h3>
                        <p className="text-sm text-slate-500 font-mono">{role.role_code}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(role.status)}`}>
                        {role.status}
                      </span>
                    </div>
                    <div className="ml-13 space-y-1 text-sm">
                      <p className="text-slate-600">
                        <span className="text-slate-400">Client:</span> {role.client_name} • {role.team_name}
                      </p>
                      <p className="text-slate-600">
                        <span className="text-slate-400">Account Manager:</span> {role.account_manager_name}
                      </p>
                      {role.description && (
                        <p className="text-slate-600 line-clamp-2 mt-2">{role.description}</p>
                      )}
                    </div>

                    {/* Stats on Hover */}
                    {hoveredRole === role.id && (
                      <div className="mt-4 p-4 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg">
                        <h4 className="font-semibold text-indigo-900 mb-3 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          Role Statistics
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-white rounded-lg p-3 border border-indigo-100">
                            <div className="flex items-center gap-2 mb-1">
                              <Send className="w-4 h-4 text-blue-600" />
                              <span className="text-xs text-slate-600 font-medium">Submissions</span>
                            </div>
                            <p className="text-2xl font-bold text-blue-600">{role.total_submissions || 0}</p>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-indigo-100">
                            <div className="flex items-center gap-2 mb-1">
                              <Users className="w-4 h-4 text-purple-600" />
                              <span className="text-xs text-slate-600 font-medium">Interviews</span>
                            </div>
                            <p className="text-2xl font-bold text-purple-600">{role.total_interviews || 0}</p>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-indigo-100">
                            <div className="flex items-center gap-2 mb-1">
                              <TrendingUp className="w-4 h-4 text-emerald-600" />
                              <span className="text-xs text-slate-600 font-medium">Deals</span>
                            </div>
                            <p className="text-2xl font-bold text-emerald-600">{role.total_deals || 0}</p>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-indigo-100">
                            <div className="flex items-center gap-2 mb-1">
                              <Users className="w-4 h-4 text-indigo-600" />
                              <span className="text-xs text-slate-600 font-medium">Candidates</span>
                            </div>
                            <p className="text-2xl font-bold text-indigo-600">{role.total_candidates || 0}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-3">
                          <div className="bg-white rounded-lg p-3 border border-green-100">
                            <div className="flex items-center gap-2 mb-1">
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              <span className="text-xs text-slate-600 font-medium">Active Candidates</span>
                            </div>
                            <p className="text-lg font-bold text-green-600">{role.active_candidates || 0}</p>
                            <p className="text-xs text-slate-500 mt-1">Still in process</p>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-red-100">
                            <div className="flex items-center gap-2 mb-1">
                              <UserX className="w-4 h-4 text-red-600" />
                              <span className="text-xs text-slate-600 font-medium">Discarded</span>
                            </div>
                            <p className="text-lg font-bold text-red-600">{role.discarded_candidates || 0}</p>
                            <p className="text-xs text-slate-500 mt-1">Not suitable</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Role Details Modal */}
      <RoleDetailsModal 
        role={selectedRole} 
        onClose={() => setSelectedRole(null)} 
      />
    </div>
  );
}
