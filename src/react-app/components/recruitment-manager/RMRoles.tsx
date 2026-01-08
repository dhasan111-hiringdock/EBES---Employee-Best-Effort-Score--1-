import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router';
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
import { fetchWithAuth, rmDiscardCandidate, rmSendCandidateToAM, rmReviewSubmission, rmReviewByRoleCandidate } from '@/react-app/utils/api';
import CreateRoleModal from './CreateRoleModal';
import EditRoleModal from './EditRoleModal';
import AssignRecruiterModal from './AssignRecruiterModal';
import { Trash2, Save } from 'lucide-react';
                            
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
  total_submissions?: number;
  under_evaluation?: number;
  under_client_evaluation?: number;
  client_rejected?: number;
  in_play_submissions?: number;
  total_interviews?: number;
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

interface RoleSubmission {
  association_id: number;
  candidate_id: number;
  candidate_name: string;
  candidate_email: string;
  candidate_phone: string;
  association_status?: string;
  submission_date: string;
  is_discarded: number;
  discarded_at?: string;
  discarded_reason?: string;
  recruiter_name: string;
  recruiter_code: string;
  submission_id?: number;
  cv_match_percent?: number;
  rm_validation_status?: string;
  rm_rate_bill?: number;
  rm_rate_pay?: number;
  rm_location?: string;
  rm_work_type?: string;
  rm_notes?: string;
  rm_reviewed_at?: string;
}

interface DailyStats {
  roles_created: number;
  submissions: number;
  forwarded_to_client: number;
  client_rejected: number;
  interviews: number;
  deals: number;
  discarded: number;
}

export default function RMRoles() {
  const location = useLocation();
  const [roles, setRoles] = useState<Role[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"active" | "non-active">("active");
  const [clientFilter, setClientFilter] = useState<string>('');
  const [teamFilter, setTeamFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [submissions, setSubmissions] = useState<{ pending_evaluation: RoleSubmission[]; under_consideration: RoleSubmission[]; rejected: RoleSubmission[] }>({
    pending_evaluation: [],
    under_consideration: [],
    rejected: [],
  });
  const [reviewEdits, setReviewEdits] = useState<Record<number, { rm_validation_status?: string; rm_payment?: string; rm_location?: string; rm_work_type?: string; rm_notes?: string; rm_score_0_5?: string }>>({});
  const [acceptOpen, setAcceptOpen] = useState<Record<number, boolean>>({});
  const submissionsRef = useRef<HTMLDivElement | null>(null);
  const [detailsTab, setDetailsTab] = useState<'role' | 'submissions'>('submissions');
  const underCons = submissions.under_consideration || [];
  const submittedToAM = underCons.filter((i: any) => (i as any).association_status === 'submitted');
  const submittedToClient = underCons.filter((i: any) => (i as any).association_status === 'client_submitted');
  const clientRejected = underCons.filter((i: any) => (i as any).association_status === 'client_rejected');
  const inPlay = underCons.filter((i: any) => !['submitted','client_submitted','client_rejected','deal'].includes((i as any).association_status));
  const pendingEvalCount = submissions.pending_evaluation?.length || 0;

  const [dailyReport, setDailyReport] = useState<{ day_before_yesterday: DailyStats; yesterday: DailyStats } | null>(null);

  useEffect(() => {
    const loadDaily = async () => {
      try {
        const res = await fetchWithAuth('/api/rm/reports/daily');
        if (res.ok) setDailyReport(await res.json());
      } catch {}
    };
    fetchInitialData();
    loadDaily();
  }, []);

  const triedTabsRef = useRef<{ activeTried?: boolean; nonActiveTried?: boolean }>({});
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const roleIdParam = params.get('roleId');
    if (!roleIdParam) return;
    const targetId = Number(roleIdParam);
    if (!Number.isFinite(targetId)) return;
    const match = roles.find(r => r.id === targetId);
    if (match) {
      setSelectedRole(match);
      setDetailsTab('submissions');
      return;
    }
    if (activeTab === 'active' && !triedTabsRef.current.nonActiveTried) {
      triedTabsRef.current.nonActiveTried = true;
      setActiveTab('non-active');
    } else if (activeTab === 'non-active' && !triedTabsRef.current.activeTried) {
      triedTabsRef.current.activeTried = true;
      setActiveTab('active');
    }
  }, [location.search, roles, activeTab]);

  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      params.append('status', activeTab);
      if (clientFilter) params.append('client_id', clientFilter);
      if (teamFilter) params.append('team_id', teamFilter);

      const response = await fetchWithAuth(`/api/rm/roles?${params.toString()}`);
      
      if (response.ok) {
        const data = await response.json();
        setRoles(data);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  }, [activeTab, clientFilter, teamFilter]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  useEffect(() => {
    if (selectedRole) {
      loadRoleSubmissions(selectedRole.id);
      setDetailsTab('submissions');
    } else {
      setSubmissions({ pending_evaluation: [], under_consideration: [], rejected: [] });
      setReviewEdits({});
    }
  }, [selectedRole]);

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
        label: 'Deal' 
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
    setActiveTab("active");
    setClientFilter('');
    setTeamFilter('');
    setSearchTerm('');
  };

  const hasActiveFilters = clientFilter || teamFilter || searchTerm;

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

  const loadRoleSubmissions = async (roleId: number) => {
    try {
      setLoadingSubmissions(true);
      const res = await fetchWithAuth(`/api/rm/role-submissions/${roleId}`);
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data);
        setTimeout(() => {
          submissionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      }
    } catch (e) {
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const updateReviewEdit = (keyId: number, field: string, value: string) => {
    setReviewEdits(prev => ({
      ...prev,
      [keyId]: { ...(prev[keyId] || {}), [field]: value }
    }));
  };

  const saveReview = async (submissionId?: number, roleId?: number, candidateId?: number, associationId?: number) => {
    const key = submissionId ?? associationId;
    const payload = key != null ? (reviewEdits[key] || {}) : {};
    let res: Response | null = null;
    if (submissionId) {
      res = await rmReviewSubmission(submissionId, payload);
    } else if (roleId && candidateId) {
      res = await rmReviewByRoleCandidate(roleId, candidateId, payload);
    }
    if (res && res.ok && selectedRole) {
      await loadRoleSubmissions(selectedRole.id);
    } else if (res && !res.ok) {
      try {
        const err = await res.json();
        alert((err as any)?.error || 'Failed to save review');
      } catch {
        alert('Failed to save review');
      }
    }
  };

  const discardCandidate = async (roleId: number, candidateId: number) => {
    const res = await rmDiscardCandidate(roleId, candidateId, undefined);
    if (res.ok && selectedRole) {
      await loadRoleSubmissions(selectedRole.id);
    }
  };
 
  const sendToAM = async (roleId: number, candidateId: number, submissionId?: number, associationId?: number) => {
    await saveReview(submissionId, roleId, candidateId, associationId);
    const res = await rmSendCandidateToAM(roleId, candidateId);
    if (res.ok && selectedRole) {
      await loadRoleSubmissions(selectedRole.id);
    } else {
      try {
        const err = await res.json();
        alert(err.error || 'Failed to send to AM');
      } catch {
        alert('Failed to send to AM');
      }
    }
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

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200">
        <div className="border-b border-slate-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab("active")}
              className={`flex-1 px-6 py-4 font-medium transition-colors ${
                activeTab === "active"
                  ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              Active Roles
            </button>
            <button
              onClick={() => setActiveTab("non-active")}
              className={`flex-1 px-6 py-4 font-medium transition-colors ${
                activeTab === "non-active"
                  ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              Non-Active Roles
            </button>
          </div>
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

      {/* Custom Reports */}
      {dailyReport && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-slate-800">Custom Reports</h3>
            <span className="text-xs text-slate-500">Daily changes</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-xl p-4">
              <p className="text-sm font-semibold text-slate-700 mb-2">Day Before Yesterday</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-slate-500">Roles Created</p><p className="font-semibold">{dailyReport.day_before_yesterday.roles_created}</p></div>
                <div><p className="text-slate-500">Submissions</p><p className="font-semibold">{dailyReport.day_before_yesterday.submissions}</p></div>
                <div><p className="text-slate-500">Submitted to Client</p><p className="font-semibold">{dailyReport.day_before_yesterday.forwarded_to_client}</p></div>
                <div><p className="text-slate-500">Client Rejected</p><p className="font-semibold">{dailyReport.day_before_yesterday.client_rejected}</p></div>
                <div><p className="text-slate-500">Interviews</p><p className="font-semibold">{dailyReport.day_before_yesterday.interviews}</p></div>
                <div><p className="text-slate-500">Deals</p><p className="font-semibold">{dailyReport.day_before_yesterday.deals}</p></div>
                <div><p className="text-slate-500">Discarded</p><p className="font-semibold">{dailyReport.day_before_yesterday.discarded}</p></div>
              </div>
            </div>
            <div className="border rounded-xl p-4">
              <p className="text-sm font-semibold text-slate-700 mb-2">Yesterday</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-slate-500">Roles Created</p><p className="font-semibold">{dailyReport.yesterday.roles_created}</p></div>
                <div><p className="text-slate-500">Submissions</p><p className="font-semibold">{dailyReport.yesterday.submissions}</p></div>
                <div><p className="text-slate-500">Submitted to Client</p><p className="font-semibold">{dailyReport.yesterday.forwarded_to_client}</p></div>
                <div><p className="text-slate-500">Client Rejected</p><p className="font-semibold">{dailyReport.yesterday.client_rejected}</p></div>
                <div><p className="text-slate-500">Interviews</p><p className="font-semibold">{dailyReport.yesterday.interviews}</p></div>
                <div><p className="text-slate-500">Deals</p><p className="font-semibold">{dailyReport.yesterday.deals}</p></div>
                <div><p className="text-slate-500">Discarded</p><p className="font-semibold">{dailyReport.yesterday.discarded}</p></div>
              </div>
            </div>
          </div>
        </div>
      )}

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
      ) : activeTab === "active" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredRoles.map((role) => {
            const statusConfig = getStatusConfig(role.status);
            return (
              <div key={role.id} className={`rounded-xl p-4 hover:shadow-md transition-shadow border ${((role.under_client_evaluation ?? 0) > 0) ? 'border-yellow-300 bg-yellow-50' : 'border-slate-200'}`}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-900 truncate">{role.title}</h3>
                    </div>
                    <p className="text-xs text-slate-600 font-mono">{role.role_code}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full border text-xs font-medium ${statusConfig.bg} ${statusConfig.color}`}>
                    {statusConfig.label}
                  </div>
                </div>
                {(role.under_client_evaluation ?? 0) > 0 && (
                  <div className="mb-2">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                      <Clock className="w-3 h-3" />
                      Pending action
                    </span>
                  </div>
                )}

                {role.description && (
                  <p className="text-sm text-slate-600 mb-3 line-clamp-2">{role.description}</p>
                )}

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                    <p className="text-xs text-indigo-700 mb-1 font-semibold">Total Submissions</p>
                    <p className="text-2xl font-bold text-indigo-600">{role.total_submissions ?? 0}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                    <p className="text-xs text-blue-700 mb-1 font-semibold">Submitted to Client</p>
                    <p className="text-2xl font-bold text-blue-600">{role.under_client_evaluation ?? 0}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <p className="text-xs text-slate-700 mb-1 font-semibold">Client Rejected</p>
                    <p className="text-2xl font-bold text-slate-900">{role.client_rejected ?? 0}</p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-3 mb-3">
                  <p className="text-xs text-slate-600 mb-2 font-medium">Interview Progress</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="col-span-3">
                      <p className="text-lg font-bold text-indigo-600">{role.total_interviews ?? 0}</p>
                      <p className="text-xs text-slate-500">Total Interviews</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedRole(role);
                    }}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                    title="View details"
                  >
                    <Eye className="w-3 h-3" />
                    Details
                  </button>
                  <button
                    onClick={(e) => handleEdit(role, e)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                    title="Edit role"
                  >
                    <Edit className="w-3 h-3" />
                    Edit
                  </button>
                </div>
              </div>
            );
          })}
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
                    Submissions
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Submitted to Client
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Client Rejected
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm font-semibold text-slate-800">{role.total_submissions ?? 0}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm font-semibold text-blue-700">{role.under_client_evaluation ?? 0}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm font-semibold text-slate-800">{role.client_rejected ?? 0}</p>
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
              <div className="mb-4 flex items-center gap-2">
                <button
                  onClick={() => setDetailsTab('submissions')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border ${detailsTab === 'submissions' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                >
                  Submission Details
                </button>
                <button
                  onClick={() => setDetailsTab('role')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border ${detailsTab === 'role' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                >
                  Role Details
                </button>
              </div>
              {detailsTab === 'role' && (
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
              )}
              {detailsTab === 'submissions' && (
              <div ref={submissionsRef}>
                <div className="mt-6 bg-white border border-slate-200 rounded-2xl">
                  <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-5 h-5 text-indigo-600" />
                      <span className="font-semibold text-slate-800">Submissions</span>
                    </div>
                    {loadingSubmissions && (
                      <div className="text-sm text-slate-500">Loading…</div>
                    )}
                  </div>
                  <div className="p-6">
                    {pendingEvalCount > 0 && (
                      <div className="sticky top-0 bg-white z-10 mb-4">
                        <button
                          onClick={async () => {
                            if (selectedRole) {
                              await loadRoleSubmissions(selectedRole.id);
                            }
                            const firstPending = submissions.pending_evaluation[0];
                            if (firstPending) {
                              setAcceptOpen(prev => ({ ...prev, [(firstPending.submission_id || firstPending.association_id)!]: true }));
                              submissionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                          }}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span className="font-medium">Review Pending Candidates ({pendingEvalCount})</span>
                        </button>
                      </div>
                    )}
                    {!loadingSubmissions && submissions.pending_evaluation.length === 0 && submissions.under_consideration.length === 0 && submissions.rejected.length === 0 ? (
                      <div className="text-center py-8 bg-slate-50 rounded-xl">
                        <Briefcase className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                        <p className="text-slate-600">No submissions yet</p>
                      </div>
                    ) : (
                      <div className="space-y-8">
                        {submissions.pending_evaluation.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <Clock className="w-4 h-4 text-indigo-600" />
                              <span className="text-sm font-semibold text-slate-700">Pending Evaluation</span>
                            </div>
                            <div className="space-y-3">
                              {submissions.pending_evaluation.map(item => (
                                <div key={item.association_id} className="border border-slate-200 rounded-xl p-4">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-slate-800">{item.candidate_name}</span>
                                        <span className="text-xs text-slate-500 font-mono">{item.candidate_id}</span>
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                                          Pending Evaluation
                                        </span>
                                      </div>
                                      <div className="text-xs text-slate-600 mt-1">
                                        {item.candidate_email || 'No email'} · {item.candidate_phone || 'No phone'}
                                      </div>
                                      <div className="text-xs text-slate-500 mt-1">
                                        Submitted on {new Date(item.submission_date).toLocaleDateString()}
                                      </div>
                                      {acceptOpen[(item.submission_id || item.association_id)!] && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                                          <input
                                            type="text"
                                            placeholder="Validation status"
                                            defaultValue={item.rm_validation_status || ''}
                                            onChange={(e) => updateReviewEdit((item.submission_id || item.association_id)!, 'rm_validation_status', e.target.value)}
                                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                          />
                                          <input
                                            type="number"
                                            step="0.1"
                                            min={0}
                                            max={5}
                                            placeholder="Validation score (0-5)"
                                            defaultValue={item.cv_match_percent != null ? String(Number(item.cv_match_percent) / 20) : (item as any).score != null ? String((item as any).score) : ''}
                                            onChange={(e) => updateReviewEdit((item.submission_id || item.association_id)!, 'rm_score_0_5', e.target.value)}
                                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                          />
                                          <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">€</span>
                                            <input
                                              type="number"
                                              placeholder="Payment"
                                              defaultValue={item.rm_rate_bill !== undefined ? String(item.rm_rate_bill) : ''}
                                              onChange={(e) => updateReviewEdit((item.submission_id || item.association_id)!, 'rm_payment', e.target.value)}
                                              className="pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-sm w-full"
                                            />
                                            {(() => {
                                              const wt = (reviewEdits[(item.submission_id || item.association_id)!]?.rm_work_type || item.rm_work_type || '').toLowerCase();
                                              const unit = wt === 'payroll' ? 'annually' : wt === 'sow' ? 'per day' : '';
                                              return unit ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{unit}</span> : null;
                                            })()}
                                          </div>
                                          <input
                                            type="text"
                                            placeholder="Location"
                                            defaultValue={item.rm_location || ''}
                                            onChange={(e) => updateReviewEdit((item.submission_id || item.association_id)!, 'rm_location', e.target.value)}
                                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                          />
                                          <select
                                            defaultValue={item.rm_work_type || ''}
                                            onChange={(e) => updateReviewEdit((item.submission_id || item.association_id)!, 'rm_work_type', e.target.value)}
                                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                          >
                                            <option value="">Select contract type</option>
                                            <option value="SOW">SOW</option>
                                            <option value="Payroll">Payroll</option>
                                          </select>
                                          <input
                                            type="text"
                                            placeholder="Notes"
                                            defaultValue={item.rm_notes || ''}
                                            onChange={(e) => updateReviewEdit((item.submission_id || item.association_id)!, 'rm_notes', e.target.value)}
                                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm md:col-span-2"
                                          />
                                        </div>
                                      )}
                                      {item.rm_reviewed_at && (
                                        <div className="mt-2 text-xs text-slate-500">
                                          Validation date: {new Date(item.rm_reviewed_at).toLocaleString()}
                                        </div>
                                      )}
                                      <div className="mt-2 text-xs text-slate-500">
                                        Recruiter: {item.recruiter_name} ({item.recruiter_code})
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                      {acceptOpen[(item.submission_id || item.association_id)!] ? (
                                        <>
                                          <button
                                            onClick={() => saveReview(item.submission_id, selectedRole!.id, item.candidate_id, item.association_id)}
                                            className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1 disabled:opacity-50"
                                          >
                                            <Save className="w-4 h-4" />
                                            Save Details
                                          </button>
                                          <button
                                            onClick={() => sendToAM(selectedRole!.id, item.candidate_id, item.submission_id, item.association_id)}
                                            className="px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1 disabled:opacity-50"
                                          >
                                            <User className="w-4 h-4" />
                                            Accept and Send to AM
                                          </button>
                                        </>
                                      ) : (
                                        <>
                                          <button
                                            onClick={() => setAcceptOpen(prev => ({ ...prev, [(item.submission_id || item.association_id)!]: true }))}
                                            className="px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                                          >
                                            Accept
                                          </button>
                                          <button
                                            onClick={() => discardCandidate(selectedRole!.id, item.candidate_id)}
                                            className="px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                            Reject
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {submittedToAM.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <CheckCircle className="w-4 h-4 text-indigo-600" />
                              <span className="text-sm font-semibold text-slate-700">Submitted to AM</span>
                            </div>
                            <div className="space-y-3">
                              {submittedToAM.map(item => (
                                <div key={item.association_id} className="border border-slate-200 rounded-xl p-4">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-slate-800">{item.candidate_name}</span>
                                        <span className="text-xs text-slate-500 font-mono">{item.candidate_id}</span>
                                        {(() => {
                                          const s = (item as any).association_status;
                                          if (s === 'submitted') {
                                            return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">Submitted to AM</span>;
                                          }
                                          if (s === 'client_submitted') {
                                            return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-100 text-blue-800 border border-blue-200">Submitted to Client</span>;
                                          }
                                          if (s === 'client_rejected') {
                                            return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-red-100 text-red-800 border border-red-200">Client Rejected</span>;
                                          }
                                          return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">In Play</span>;
                                        })()}
                                      </div>
                                      <div className="text-xs text-slate-600 mt-1">
                                        {item.candidate_email || 'No email'} · {item.candidate_phone || 'No phone'}
                                      </div>
                                      <div className="text-xs text-slate-500 mt-1">
                                        Submitted on {new Date(item.submission_date).toLocaleDateString()}
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                                        <input
                                          type="text"
                                          placeholder="Validation status"
                                          defaultValue={item.rm_validation_status || ''}
                                          onChange={(e) => updateReviewEdit(item.submission_id || 0, 'rm_validation_status', e.target.value)}
                                          className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                          disabled={!item.submission_id}
                                        />
                                        <input
                                          type="number"
                                          step="0.1"
                                          min={0}
                                          max={5}
                                          placeholder="Validation score (0-5)"
                                          defaultValue={(item as any).score != null ? String((item as any).score) : ''}
                                          onChange={(e) => updateReviewEdit(item.submission_id || 0, 'rm_score_0_5', e.target.value)}
                                          className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                          disabled={!item.submission_id}
                                        />
                                        <div className="relative">
                                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">€</span>
                                          <input
                                            type="number"
                                            placeholder="Payment"
                                            defaultValue={item.rm_rate_bill !== undefined ? String(item.rm_rate_bill) : ''}
                                            onChange={(e) => updateReviewEdit(item.submission_id || 0, 'rm_payment', e.target.value)}
                                            className="pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-sm w-full"
                                            disabled={!item.submission_id}
                                          />
                                          {(() => {
                                            const wt = (reviewEdits[item.submission_id || 0]?.rm_work_type || item.rm_work_type || '').toLowerCase();
                                            const unit = wt === 'payroll' ? 'annually' : wt === 'sow' ? 'per day' : '';
                                            return unit ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{unit}</span> : null;
                                          })()}
                                        </div>
                                        <input
                                          type="text"
                                          placeholder="Location"
                                          defaultValue={item.rm_location || ''}
                                          onChange={(e) => updateReviewEdit(item.submission_id || 0, 'rm_location', e.target.value)}
                                          className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                          disabled={!item.submission_id}
                                        />
                                        <select
                                          defaultValue={item.rm_work_type || ''}
                                          onChange={(e) => updateReviewEdit(item.submission_id || 0, 'rm_work_type', e.target.value)}
                                          className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                          disabled={!item.submission_id}
                                        >
                                          <option value="">Select contract type</option>
                                          <option value="SOW">SOW</option>
                                          <option value="Payroll">Payroll</option>
                                        </select>
                                        <input
                                          type="text"
                                          placeholder="Notes"
                                          onChange={(e) => updateReviewEdit(item.submission_id || 0, 'rm_notes', e.target.value)}
                                          className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                          disabled={!item.submission_id}
                                        />
                                      </div>
                                      {item.rm_reviewed_at && (
                                        <div className="mt-2 text-xs text-slate-500">
                                          Validation date: {new Date(item.rm_reviewed_at).toLocaleString()}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                      <button
                                        onClick={() => discardCandidate(selectedRole!.id, item.candidate_id)}
                                        className="px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                        Reject
                                      </button>
                                      <button
                                        onClick={() => saveReview(item.submission_id)}
                                        disabled={!item.submission_id}
                                        className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1 disabled:opacity-50"
                                      >
                                        <Save className="w-4 h-4" />
                                        Save Review
                                      </button>
                                      <button
                                        onClick={() => sendToAM(selectedRole!.id, item.candidate_id, item.submission_id, item.association_id)}
                                        disabled={!item.submission_id}
                                        className="px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1 disabled:opacity-50"
                                      >
                                        <User className="w-4 h-4" />
                                        Send to AM
                                      </button>
                                    </div>
                                  </div>
                                  <div className="mt-3 text-xs text-slate-500">
                                    Recruiter: {item.recruiter_name} ({item.recruiter_code})
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {submittedToClient.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <CheckCircle className="w-4 h-4 text-blue-600" />
                              <span className="text-sm font-semibold text-slate-700">Submitted to Client</span>
                            </div>
                            <div className="space-y-3">
                              {submittedToClient.map(item => (
                                <div key={item.association_id} className="border border-slate-200 rounded-xl p-4">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-slate-800">{item.candidate_name}</span>
                                        <span className="text-xs text-slate-500 font-mono">{item.candidate_id}</span>
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-100 text-blue-800 border border-blue-200">Submitted to Client</span>
                                      </div>
                                      <div className="text-xs text-slate-600 mt-1">{item.candidate_email || 'No email'} · {item.candidate_phone || 'No phone'}</div>
                                      <div className="text-xs text-slate-500 mt-1">Submitted on {new Date(item.submission_date).toLocaleDateString()}</div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {clientRejected.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <XCircle className="w-4 h-4 text-red-600" />
                              <span className="text-sm font-semibold text-slate-700">Client Rejected</span>
                            </div>
                            <div className="space-y-3">
                              {clientRejected.map(item => (
                                <div key={item.association_id} className="border border-slate-200 rounded-xl p-4">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-slate-800">{item.candidate_name}</span>
                                        <span className="text-xs text-slate-500 font-mono">{item.candidate_id}</span>
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-red-100 text-red-800 border border-red-200">Client Rejected</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {inPlay.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <CheckCircle className="w-4 h-4 text-emerald-600" />
                              <span className="text-sm font-semibold text-slate-700">In Play</span>
                            </div>
                            <div className="space-y-3">
                              {inPlay.map(item => (
                                <div key={item.association_id} className="border border-slate-200 rounded-xl p-4">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-slate-800">{item.candidate_name}</span>
                                        <span className="text-xs text-slate-500 font-mono">{item.candidate_id}</span>
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">In Play</span>
                                      </div>
                                      <div className="text-xs text-slate-600 mt-1">
                                        {item.candidate_email || 'No email'} · {item.candidate_phone || 'No phone'}
                                      </div>
                                      <div className="text-xs text-slate-500 mt-1">
                                        Submitted on {new Date(item.submission_date).toLocaleDateString()}
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                                        <input
                                          type="text"
                                          placeholder="Validation status"
                                          defaultValue={item.rm_validation_status || ''}
                                          onChange={(e) => updateReviewEdit(item.submission_id || 0, 'rm_validation_status', e.target.value)}
                                          className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                          disabled={!item.submission_id}
                                        />
                                        <input
                                          type="number"
                                          step="0.1"
                                          min={0}
                                          max={5}
                                          placeholder="Validation score (0-5)"
                                          defaultValue={(item as any).score != null ? String((item as any).score) : ''}
                                          onChange={(e) => updateReviewEdit(item.submission_id || 0, 'rm_score_0_5', e.target.value)}
                                          className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                          disabled={!item.submission_id}
                                        />
                                        <div className="relative">
                                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">€</span>
                                          <input
                                            type="number"
                                            placeholder="Payment"
                                            defaultValue={item.rm_rate_bill !== undefined ? String(item.rm_rate_bill) : ''}
                                            onChange={(e) => updateReviewEdit(item.submission_id || 0, 'rm_payment', e.target.value)}
                                            className="pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-sm w-full"
                                            disabled={!item.submission_id}
                                          />
                                          {(() => {
                                            const wt = (reviewEdits[item.submission_id || 0]?.rm_work_type || item.rm_work_type || '').toLowerCase();
                                            const unit = wt === 'payroll' ? 'annually' : wt === 'sow' ? 'per day' : '';
                                            return unit ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{unit}</span> : null;
                                          })()}
                                        </div>
                                        <input
                                          type="text"
                                          placeholder="Location"
                                          defaultValue={item.rm_location || ''}
                                          onChange={(e) => updateReviewEdit(item.submission_id || 0, 'rm_location', e.target.value)}
                                          className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                          disabled={!item.submission_id}
                                        />
                                        <select
                                          defaultValue={item.rm_work_type || ''}
                                          onChange={(e) => updateReviewEdit(item.submission_id || 0, 'rm_work_type', e.target.value)}
                                          className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                          disabled={!item.submission_id}
                                        >
                                          <option value="">Select contract type</option>
                                          <option value="SOW">SOW</option>
                                          <option value="Payroll">Payroll</option>
                                        </select>
                                        <input
                                          type="text"
                                          placeholder="Notes"
                                          onChange={(e) => updateReviewEdit(item.submission_id || 0, 'rm_notes', e.target.value)}
                                          className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                          disabled={!item.submission_id}
                                        />
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                      <button
                                        onClick={() => discardCandidate(selectedRole!.id, item.candidate_id)}
                                        className="px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                        Reject
                                      </button>
                                      <button
                                        onClick={() => saveReview(item.submission_id)}
                                        disabled={!item.submission_id}
                                        className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1 disabled:opacity-50"
                                      >
                                        <Save className="w-4 h-4" />
                                        Save Review
                                      </button>
                                      <button
                                        onClick={() => sendToAM(selectedRole!.id, item.candidate_id, item.submission_id, item.association_id)}
                                        disabled={!item.submission_id}
                                        className="px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1 disabled:opacity-50"
                                      >
                                        <User className="w-4 h-4" />
                                        Send to AM
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {submissions.rejected.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <XCircle className="w-4 h-4 text-red-600" />
                              <span className="text-sm font-semibold text-slate-700">Rejected</span>
                            </div>
                            <div className="space-y-3">
                              {submissions.rejected.map(item => (
                                <div key={item.association_id} className="border border-slate-200 rounded-xl p-4 bg-red-50/40">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-slate-800">{item.candidate_name}</span>
                                        <span className="text-xs text-slate-500 font-mono">{item.candidate_id}</span>
                                      </div>
                                      <div className="text-xs text-slate-600 mt-1">
                                        {item.candidate_email || 'No email'} · {item.candidate_phone || 'No phone'}
                                      </div>
                                      <div className="text-xs text-slate-500 mt-1">
                                        {item.is_discarded === 1 ? (
                                          <>Discarded on {item.discarded_at ? new Date(item.discarded_at).toLocaleDateString() : 'N/A'}</>
                                        ) : (
                                          <>Client Rejected</>
                                        )}
                                      </div>
                                      {item.is_discarded === 1 && (
                                        <div className="text-xs text-slate-600 mt-1">
                                          Reason: {item.discarded_reason || 'N/A'}
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      Recruiter: {item.recruiter_name} ({item.recruiter_code})
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              )}
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
