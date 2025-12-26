import { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Eye, 
  Briefcase, 
  CheckCircle, 
  XCircle, 
  TrendingUp,
  Users,
  Building2,
  Clock,
  X,
  Calendar,
  User,
  Plus,
  Edit,
  UserPlus
} from 'lucide-react';
import { fetchWithAuth } from '@/react-app/utils/api';
import CreateRoleModal from './CreateRoleModal';
import EditRoleModal from './EditRoleModal';
import AssignRecruiterModal from './AssignRecruiterModal';

interface Role {
  id: number;
  role_code: string;
  title: string;
  description: string;
  status: string;
  client_id: number;
  client_name: string;
  client_code: string;
  team_id: number;
  team_name: string;
  team_code: string;
  account_manager_id: number;
  account_manager_name: string;
  account_manager_code: string;
  created_at: string;
}

interface Client {
  id: number;
  name: string;
  client_code: string;
}

interface Team {
  id: number;
  name: string;
  team_code: string;
}

interface RoleStats {
  total: number;
  active: number;
  deals: number;
  lost: number;
  on_hold: number;
  no_answer: number;
}

export default function RMRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [clientFilter, setClientFilter] = useState<string>('');
  const [teamFilter, setTeamFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [statusFilter, clientFilter, teamFilter]);

  const fetchInitialData = async () => {
    try {
      const [clientsRes, teamsRes] = await Promise.all([
        fetchWithAuth('/api/rm/clients'),
        fetchWithAuth('/api/rm/teams')
      ]);

      if (clientsRes.ok) setClients(await clientsRes.json());
      if (teamsRes.ok) setTeams(await teamsRes.json());
    } catch (error) {
      console.error('Failed to fetch initial data:', error);
    }
  };

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (statusFilter === 'active') params.append('status', 'active');
      else if (statusFilter === 'non-active') params.append('status', 'non-active');
      if (clientFilter) params.append('client_id', clientFilter);
      if (teamFilter) params.append('team_id', teamFilter);

      const response = await fetchWithAuth(`/api/rm/roles?${params.toString()}`);
      
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

  const filteredRoles = roles.filter(role => {
    const matchesSearch = 
      role.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      role.role_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      role.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      role.team_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const stats: RoleStats = {
    total: roles.length,
    active: roles.filter(r => r.status === 'active').length,
    deals: roles.filter(r => r.status === 'deal').length,
    lost: roles.filter(r => r.status === 'lost').length,
    on_hold: roles.filter(r => r.status === 'on_hold').length,
    no_answer: roles.filter(r => r.status === 'no_answer').length,
  };

  const getStatusConfig = (status: string) => {
    const configs: { [key: string]: { color: string; bg: string; icon: any; label: string } } = {
      active: { 
        color: 'text-emerald-700', 
        bg: 'bg-emerald-50 border-emerald-200', 
        icon: CheckCircle, 
        label: 'Active' 
      },
      deal: { 
        color: 'text-blue-700', 
        bg: 'bg-blue-50 border-blue-200', 
        icon: TrendingUp, 
        label: 'Deal Closed' 
      },
      lost: { 
        color: 'text-red-700', 
        bg: 'bg-red-50 border-red-200', 
        icon: XCircle, 
        label: 'Lost' 
      },
      on_hold: { 
        color: 'text-yellow-700', 
        bg: 'bg-yellow-50 border-yellow-200', 
        icon: Clock, 
        label: 'On Hold' 
      },
      no_answer: { 
        color: 'text-orange-700', 
        bg: 'bg-orange-50 border-orange-200', 
        icon: XCircle, 
        label: 'No Answer' 
      },
      cancelled: { 
        color: 'text-gray-700', 
        bg: 'bg-gray-50 border-gray-200', 
        icon: XCircle, 
        label: 'Cancelled' 
      },
    };
    return configs[status] || configs.active;
  };

  const clearFilters = () => {
    setStatusFilter('');
    setClientFilter('');
    setTeamFilter('');
    setSearchTerm('');
  };

  const hasActiveFilters = statusFilter || clientFilter || teamFilter || searchTerm;

  const handleEdit = (role: Role, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingRole(role);
    setShowEditModal(true);
  };

  const handleCreateSuccess = () => {
    fetchRoles();
  };

  const handleEditSuccess = () => {
    fetchRoles();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Roles Overview</h2>
          <p className="text-slate-500 mt-1">Monitor and track all assigned roles across your teams</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowAssignModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors shadow-lg hover:shadow-xl"
          >
            <UserPlus className="w-5 h-5" />
            Assign to Recruiter
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg hover:shadow-xl"
          >
            <Plus className="w-5 h-5" />
            Create Role
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-indigo-100 text-sm font-medium">Total Roles</p>
              <p className="text-3xl font-bold mt-1">{stats.total}</p>
            </div>
            <Briefcase className="w-10 h-10 text-indigo-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-sm font-medium">Active</p>
              <p className="text-3xl font-bold mt-1">{stats.active}</p>
            </div>
            <CheckCircle className="w-10 h-10 text-emerald-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Deals</p>
              <p className="text-3xl font-bold mt-1">{stats.deals}</p>
            </div>
            <TrendingUp className="w-10 h-10 text-blue-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm font-medium">Lost</p>
              <p className="text-3xl font-bold mt-1">{stats.lost}</p>
            </div>
            <XCircle className="w-10 h-10 text-red-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-100 text-sm font-medium">On Hold</p>
              <p className="text-3xl font-bold mt-1">{stats.on_hold}</p>
            </div>
            <Clock className="w-10 h-10 text-yellow-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium">No Answer</p>
              <p className="text-3xl font-bold mt-1">{stats.no_answer}</p>
            </div>
            <XCircle className="w-10 h-10 text-orange-200" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-600" />
            <h3 className="font-semibold text-slate-800">Filters</h3>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium ml-2"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by title, code..."
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all appearance-none bg-white"
            >
              <option value="">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="non-active">Non-Active</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Client</label>
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all appearance-none bg-white"
            >
              <option value="">All Clients</option>
              {clients.map(client => (
                <option key={client.id} value={String(client.id)}>
                  {client.name} ({client.client_code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Team</label>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all appearance-none bg-white"
            >
              <option value="">All Teams</option>
              {teams.map(team => (
                <option key={team.id} value={String(team.id)}>
                  {team.name} ({team.team_code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Roles Display */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-12">
          <div className="flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent mb-4"></div>
            <p className="text-slate-500">Loading roles...</p>
          </div>
        </div>
      ) : filteredRoles.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-12">
          <div className="text-center">
            <Briefcase className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-800 mb-2">No roles found</h3>
            <p className="text-slate-500 mb-4">
              {hasActiveFilters 
                ? 'Try adjusting your filters to see more results' 
                : 'No roles have been assigned yet'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Role Code
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Team
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Account Manager
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredRoles.map((role) => {
                  const statusConfig = getStatusConfig(role.status);
                  const StatusIcon = statusConfig.icon;

                  return (
                    <tr 
                      key={role.id} 
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedRole(role)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-sm font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                          {role.role_code}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="max-w-xs">
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {role.title}
                          </p>
                          {role.description && (
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              {role.description}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${statusConfig.color} ${statusConfig.bg}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {statusConfig.label}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-slate-800">{role.client_name}</p>
                          <p className="text-xs text-slate-500 font-mono">{role.client_code}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-slate-800">{role.team_name}</p>
                          <p className="text-xs text-slate-500 font-mono">{role.team_code}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-slate-800">{role.account_manager_name}</p>
                          <p className="text-xs text-slate-500 font-mono">{role.account_manager_code}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm text-slate-700">
                          {new Date(role.created_at).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRole(role);
                            }}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => handleEdit(role, e)}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Edit Role"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Results count */}
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-200">
            <p className="text-sm text-slate-600">
              Showing <span className="font-semibold text-slate-800">{filteredRoles.length}</span> of <span className="font-semibold text-slate-800">{roles.length}</span> roles
            </p>
          </div>
        </div>
      )}

      {/* Role Details Modal */}
      {selectedRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-indigo-700 px-8 py-6 flex items-center justify-between text-white z-10">
              <div>
                <h3 className="text-2xl font-bold">Role Details</h3>
                <p className="text-indigo-100 text-sm mt-1 font-mono">{selectedRole.role_code}</p>
              </div>
              <button
                onClick={() => setSelectedRole(null)}
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
                  {(() => {
                    const config = getStatusConfig(selectedRole.status);
                    const StatusIcon = config.icon;
                    return (
                      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border ${config.color} ${config.bg}`}>
                        <StatusIcon className="w-5 h-5" />
                        <span className="font-semibold">{config.label}</span>
                      </div>
                    );
                  })()}
                </div>

                {/* Title */}
                <div>
                  <label className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Title</label>
                  <p className="text-2xl font-bold text-slate-800 mt-2">
                    {selectedRole.title}
                  </p>
                </div>

                {/* Description */}
                {selectedRole.description && (
                  <div>
                    <label className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Description</label>
                    <p className="text-slate-700 mt-2 leading-relaxed">{selectedRole.description}</p>
                  </div>
                )}

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-indigo-100 rounded-lg p-2">
                        <Building2 className="w-5 h-5 text-indigo-600" />
                      </div>
                      <label className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Client</label>
                    </div>
                    <p className="text-lg font-bold text-slate-800">{selectedRole.client_name}</p>
                    <p className="text-sm text-slate-500 font-mono mt-1">{selectedRole.client_code}</p>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-emerald-100 rounded-lg p-2">
                        <Users className="w-5 h-5 text-emerald-600" />
                      </div>
                      <label className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Team</label>
                    </div>
                    <p className="text-lg font-bold text-slate-800">{selectedRole.team_name}</p>
                    <p className="text-sm text-slate-500 font-mono mt-1">{selectedRole.team_code}</p>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 md:col-span-2">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-blue-100 rounded-lg p-2">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <label className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Account Manager</label>
                    </div>
                    <p className="text-lg font-bold text-slate-800">{selectedRole.account_manager_name}</p>
                    <p className="text-sm text-slate-500 font-mono mt-1">{selectedRole.account_manager_code}</p>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 md:col-span-2">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-purple-100 rounded-lg p-2">
                        <Calendar className="w-5 h-5 text-purple-600" />
                      </div>
                      <label className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Created Date</label>
                    </div>
                    <p className="text-lg font-bold text-slate-800">
                      {new Date(selectedRole.created_at).toLocaleDateString('en-US', { 
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
            <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-8 py-4 flex gap-3">
              <button
                onClick={() => setSelectedRole(null)}
                className="flex-1 px-6 py-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 font-medium transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  if (selectedRole) {
                    setEditingRole(selectedRole);
                    setShowEditModal(true);
                    setSelectedRole(null);
                  }
                }}
                className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Edit className="w-5 h-5" />
                Edit Role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Role Modal */}
      <CreateRoleModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Edit Role Modal */}
      <EditRoleModal
        isOpen={showEditModal}
        role={editingRole}
        onClose={() => {
          setShowEditModal(false);
          setEditingRole(null);
        }}
        onSuccess={handleEditSuccess}
      />

      {/* Assign Recruiter Modal */}
      <AssignRecruiterModal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        onSuccess={() => {
          // Optionally refresh roles or show success message
        }}
      />
    </div>
  );
}
