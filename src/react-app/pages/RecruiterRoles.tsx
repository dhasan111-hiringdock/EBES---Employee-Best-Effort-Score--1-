import { useState, useEffect } from "react";
import { Briefcase, Search, CheckCircle, XCircle, Users, Send, Download, Eye, Plus, BarChart3 } from "lucide-react";
import { fetchWithAuth, getRecruiterRoleSubmissions } from "@/react-app/utils/api";
import RoleDetailsModal from "@/react-app/components/recruiter/RoleDetailsModal";
import AddSubmissionModal from "@/react-app/components/recruiter/AddSubmissionModal";
import { useNavigate } from "react-router";

interface Role {
  id: number;
  role_code: string;
  title: string;
  description: string;
  client_id: number;
  client_name: string;
  team_id: number;
  team_name: string;
  account_manager_name: string;
  status: string;
  is_active: number;
  total_submissions: number;
  total_candidates: number;
  active_candidates: number;
  discarded_candidates: number;
  total_interviews: number;
  interview_1_count?: number;
  interview_2_count?: number;
  interview_3_count?: number;
  total_deals: number;
  in_play_submissions: number;
  client_submitted?: number;
  client_rejected?: number;
  has_pending_dropout?: number | boolean;
  has_dropout?: number | boolean;
  days_open?: number;
  first_submission_days?: number | null;
  first_interview_days?: number | null;
  created_at: string;
}

export default function RecruiterRoles() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<'recent' | 'title' | 'client' | 'team' | 'status'>('recent');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [expandedRoleId, setExpandedRoleId] = useState<number | null>(null);
  const [roleSubmissions, setRoleSubmissions] = useState<Record<number, { under_consideration: any[]; rejected: any[]; total_submissions: number }>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [addClient, setAddClient] = useState<{ id: number; name: string; client_code: string; team_id: number; team_name: string; team_code: string } | null>(null);
  const [clients, setClients] = useState<Array<{ id: number; name: string; client_code: string; team_id?: number; team_name?: string }>>([]);
  const [teams, setTeams] = useState<Array<{ id: number; name: string; team_code: string }>>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | ''>('');
  const [selectedTeamId, setSelectedTeamId] = useState<number | ''>('');
  const allExportFields = [
    'role_code',
    'title',
    'client_name',
    'team_name',
    'account_manager_name',
    'status',
    'total_submissions',
    'total_interviews',
    'total_deals',
    'total_candidates',
    'active_candidates',
    'discarded_candidates',
    'in_play_submissions',
    'client_submitted',
    'client_rejected',
    'created_at'
  ];
  const fieldLabels: Record<string, string> = {
    role_code: 'Role Code',
    title: 'Title',
    client_name: 'Client',
    team_name: 'Team',
    account_manager_name: 'Account Manager',
    status: 'Status',
    total_submissions: 'Submissions',
    total_interviews: 'Interviews',
    total_deals: 'Deals',
    total_candidates: 'Candidates',
    active_candidates: 'Active Candidates',
    discarded_candidates: 'Discarded Candidates',
    in_play_submissions: 'In-Play Submissions',
    client_submitted: 'Client Submitted',
    client_rejected: 'Client Rejected',
    created_at: 'Created At'
  };
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportFields, setExportFields] = useState<string[]>(allExportFields);
  const [exportPresets, setExportPresets] = useState<Array<{ name: string; fields: string[] }>>([]);
  const [presetName, setPresetName] = useState('');

  useEffect(() => {
    try {
      const presetsStr = localStorage.getItem('recruiterRolesExportPresets');
      if (presetsStr) {
        const parsed = JSON.parse(presetsStr);
        if (Array.isArray(parsed)) setExportPresets(parsed);
      }
      const lastFieldsStr = localStorage.getItem('recruiterRolesExportLastFields');
      if (lastFieldsStr) {
        const arr = JSON.parse(lastFieldsStr);
        if (Array.isArray(arr) && arr.length > 0) {
          setExportFields(arr.filter((f: string) => allExportFields.includes(f)));
        }
      }
    } catch {}
  }, []);

  const openExport = () => {
    setIsExportOpen(true);
  };

  const toggleField = (f: string) => {
    setExportFields((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  };

  const selectAllFields = () => {
    setExportFields(allExportFields);
  };

  const clearAllFields = () => {
    setExportFields([]);
  };

  const savePreset = () => {
    const name = presetName.trim();
    if (!name) return;
    setExportPresets((prev) => {
      const filtered = prev.filter((p) => p.name !== name);
      const next = [...filtered, { name, fields: exportFields }];
      try {
        localStorage.setItem('recruiterRolesExportPresets', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const applyPresetByName = (name: string) => {
    const p = exportPresets.find((x) => x.name === name);
    if (!p) return;
    setExportFields(p.fields.filter((f) => allExportFields.includes(f)));
  };

  const deletePresetByName = (name: string) => {
    setExportPresets((prev) => {
      const next = prev.filter((p) => p.name !== name);
      try {
        localStorage.setItem('recruiterRolesExportPresets', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const exportSelectedCsv = () => {
    const fields = exportFields.length > 0 ? exportFields : allExportFields;
    const headers = fields;
    const csvRows = roles.map((r) =>
      fields
        .map((f) => {
          switch (f) {
            case 'role_code':
              return (r.role_code || '').replace(/,/g, ' ');
            case 'title':
              return (r.title || '').replace(/,/g, ' ');
            case 'client_name':
              return (r.client_name || '').replace(/,/g, ' ');
            case 'team_name':
              return (r.team_name || '').replace(/,/g, ' ');
            case 'account_manager_name':
              return (r.account_manager_name || '').replace(/,/g, ' ');
            case 'status':
              return r.status || '';
            case 'total_submissions':
              return String(r.total_submissions || 0);
            case 'total_interviews':
              return String(r.total_interviews || 0);
            case 'total_deals':
              return String(r.total_deals || 0);
            case 'total_candidates':
              return String(r.total_candidates || 0);
            case 'active_candidates':
              return String(r.active_candidates || 0);
            case 'discarded_candidates':
              return String(r.discarded_candidates || 0);
            case 'in_play_submissions':
              return String(r.in_play_submissions || 0);
            case 'client_submitted':
              return String(r.client_submitted || 0);
            case 'client_rejected':
              return String(r.client_rejected || 0);
            case 'created_at':
              return r.created_at || '';
            default:
              return '';
          }
        })
        .join(',')
    );
    const csv = [headers.join(',')].concat(csvRows).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recruiter-roles-${activeTab}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    try {
      localStorage.setItem('recruiterRolesExportLastFields', JSON.stringify(fields));
    } catch {}
    setIsExportOpen(false);
  };

  useEffect(() => {
    fetchRoles();
  }, [activeTab, searchQuery, selectedClientId, selectedTeamId]);

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [cRes, tRes] = await Promise.all([
          fetchWithAuth('/api/recruiter/clients'),
          fetchWithAuth('/api/recruiter/teams')
        ]);
        if (cRes && cRes.ok) {
          const cData = await cRes.json();
          setClients(cData || []);
        }
        if (tRes && tRes.ok) {
          const tData = await tRes.json();
          setTeams(tData || []);
        }
        try {
          const saved = localStorage.getItem('recruiterRolesFilters');
          if (saved) {
            const f = JSON.parse(saved);
            if (f.activeTab === 'active' || f.activeTab === 'inactive') setActiveTab(f.activeTab);
            if (typeof f.selectedClientId === 'number' || f.selectedClientId === '') setSelectedClientId(f.selectedClientId);
            if (typeof f.selectedTeamId === 'number' || f.selectedTeamId === '') setSelectedTeamId(f.selectedTeamId);
            if (typeof f.searchQuery === 'string') setSearchQuery(f.searchQuery);
            if (['recent','title','client','team','status'].includes(f.sortKey)) setSortKey(f.sortKey);
            if (f.sortOrder === 'asc' || f.sortOrder === 'desc') setSortOrder(f.sortOrder);
          }
        } catch {}
      } catch {
        // ignore
      }
    };
    loadFilters();
  }, []);

  useEffect(() => {
    try {
      const payload = {
        activeTab,
        selectedClientId,
        selectedTeamId,
        searchQuery,
        sortKey,
        sortOrder
      };
      localStorage.setItem('recruiterRolesFilters', JSON.stringify(payload));
    } catch {}
  }, [activeTab, selectedClientId, selectedTeamId, searchQuery, sortKey, sortOrder]);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const isActive = activeTab === 'active' ? '1' : '0';
      const params = new URLSearchParams();
      params.set('is_active', isActive);
      if (searchQuery) params.set('search', searchQuery);
      if (selectedClientId) params.set('client_id', String(selectedClientId));
      if (selectedTeamId) params.set('team_id', String(selectedTeamId));
      const response = await fetchWithAuth(`/api/recruiter/roles-list?${params.toString()}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log("RecruiterRoles payload", Array.isArray(data) ? data.length : null, Array.isArray(data) ? data.slice(0, 1) : data);
        if (Array.isArray(data) && data.length === 0) {
          console.warn("RecruiterRoles empty response", { isActive, searchQuery, selectedClientId, selectedTeamId });
        }
        setRoles(data);
      }
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700 border-green-200',
    deal: 'bg-blue-100 text-blue-700 border-blue-200',
    lost: 'bg-red-100 text-red-700 border-red-200',
    on_hold: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    cancelled: 'bg-gray-100 text-gray-700 border-gray-200',
    no_answer: 'bg-orange-100 text-orange-700 border-orange-200',
  };

  const statusLabels: Record<string, string> = {
    active: 'Active',
    deal: 'Deal',
    lost: 'Lost',
    on_hold: 'On Hold',
    cancelled: 'Cancelled',
    no_answer: 'No Answer',
  };

  

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Roles</h2>
          <p className="text-slate-500 mt-1">View all roles and their submission statistics</p>
        </div>
        <button
          onClick={openExport}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          title="Export CSV"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
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
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sticky top-0 z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
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
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value ? parseInt(e.target.value) : '')}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            title="Filter by Client"
          >
            <option value="">Filter: Client (All)</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.client_code})
              </option>
            ))}
          </select>
          <select
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value ? parseInt(e.target.value) : '')}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            title="Filter by Team"
          >
            <option value="">Filter: Team (All)</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.team_code})
              </option>
            ))}
          </select>
          <div className="flex gap-3">
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as any)}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="recent">Sort: Recent</option>
              <option value="title">Sort: Title</option>
              <option value="client">Sort: Client</option>
              <option value="team">Sort: Team</option>
              <option value="status">Sort: Status</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm w-28"
            >
              <option value="desc">Order: Desc</option>
              <option value="asc">Order: Asc</option>
            </select>
          </div>
        </div>
      </div>

      {/* Roles Cards */}
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
            {(() => {
              const statusWeight = (s: string) => {
                if (s === 'deal') return 5;
                if (s === 'active') return 4;
                if (s === 'on_hold') return 3;
                if (s === 'lost') return 2;
                if (s === 'cancelled') return 1;
                return 0;
              };
              const sorted = [...roles].sort((a, b) => {
                if (sortKey === 'title') {
                  const cmp = (a.title || '').localeCompare(b.title || '');
                  return sortOrder === 'desc' ? cmp : -cmp;
                }
                if (sortKey === 'client') {
                  const cmp = (a.client_name || '').localeCompare(b.client_name || '');
                  return sortOrder === 'desc' ? cmp : -cmp;
                }
                if (sortKey === 'team') {
                  const cmp = (a.team_name || '').localeCompare(b.team_name || '');
                  return sortOrder === 'desc' ? cmp : -cmp;
                }
                if (sortKey === 'status') {
                  const wa = statusWeight(a.status || '');
                  const wb = statusWeight(b.status || '');
                  return sortOrder === 'desc' ? wb - wa : wa - wb;
                }
                const da = a.created_at ? new Date(a.created_at).getTime() : 0;
                const db = b.created_at ? new Date(b.created_at).getTime() : 0;
                return sortOrder === 'desc' ? db - da : da - db;
              });
              return sorted.map((role) => (
                <div key={role.id} className={`rounded-xl p-4 hover:shadow-md transition-shadow border ${((role.client_submitted ?? 0) > 0) ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">{role.title}</h3>
                        {(role.client_submitted ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                            Pending action
                          </span>
                        )}
                        {role.has_pending_dropout ? (
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-semibold rounded border border-orange-200">
                            Pending
                          </span>
                        ) : null}
                        {role.has_dropout ? (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded border border-red-200">
                            Dropped Out
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-gray-600 font-mono">{role.role_code}</p>
                      <p className="text-xs text-slate-600 mt-1">{role.client_name} • {role.team_name}</p>
                    </div>
                    <div className={`px-3 py-1 rounded-full border text-xs font-medium ${statusColors[role.status]}`}>
                      {statusLabels[role.status]}
                    </div>
                  </div>
                  {role.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{role.description}</p>
                  )}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                      <p className="text-xs text-indigo-700 mb-1 font-semibold">Total Submissions</p>
                      <p className="text-2xl font-bold text-indigo-600">{role.total_submissions}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                      <p className="text-xs text-blue-700 mb-1 font-semibold">Submitted to Client</p>
                      <p className="text-2xl font-bold text-blue-600">{role.client_submitted ?? 0}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <p className="text-xs text-gray-700 mb-1 font-semibold">Client Rejected</p>
                      <p className="text-2xl font-bold text-gray-900">{role.client_rejected ?? 0}</p>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 mb-3">
                    <p className="text-xs text-gray-600 mb-2 font-medium">Interview Progress</p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold text-indigo-600">{role.interview_1_count ?? 0}</p>
                        <p className="text-xs text-gray-500">1st Round</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-indigo-600">{role.interview_2_count ?? 0}</p>
                        <p className="text-xs text-gray-500">2nd Round</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-indigo-600">{role.interview_3_count ?? 0}</p>
                        <p className="text-xs text-gray-500">Decision Pending</p>
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
                      onClick={() => setSelectedRole(role)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      title="View details"
                    >
                      <Eye className="w-3 h-3" />
                      Details
                    </button>
                    <button
                      onClick={async () => {
                        setExpandedRoleId(expandedRoleId === role.id ? null : role.id);
                        if (expandedRoleId !== role.id) {
                          const res = await getRecruiterRoleSubmissions(role.id);
                          if (res.ok) {
                            const data = await res.json();
                            setRoleSubmissions((prev) => ({ ...prev, [role.id]: { under_consideration: data.under_consideration || [], rejected: data.rejected || [], total_submissions: Number(data.total_submissions || 0) } }));
                          }
                        }
                      }}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      title="View submissions and candidates"
                    >
                      <Users className="w-3 h-3" />
                      View
                    </button>
                    <button
                      onClick={() => navigate(`/recruiter/pipeline?client_id=${role.client_id}&team_id=${role.team_id}`)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      title="Open Pipeline"
                    >
                      <BarChart3 className="w-3 h-3" />
                      Pipeline
                    </button>
                    <button
                      onClick={() => {
                        setAddClient({
                          id: role.client_id,
                          name: role.client_name,
                          client_code: "",
                          team_id: role.team_id,
                          team_name: role.team_name,
                          team_code: "",
                        });
                        setShowAddModal(true);
                      }}
                      className="px-3 py-2 text-sm text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-colors"
                      title="Add submission"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  {expandedRoleId === role.id && (
                    <div className="mt-3 rounded-lg border border-slate-200">
                      <div className="px-3 py-2 border-b border-slate-100 text-sm font-semibold text-slate-700">Submissions</div>
                      <div className="p-3 space-y-3">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Send className="w-4 h-4 text-indigo-600" />
                            <span className="text-sm font-semibold text-slate-700">Under Consideration</span>
                          </div>
                          <div className="space-y-2">
                            {(roleSubmissions[role.id]?.under_consideration || []).map((item) => (
                              <div key={`${item.association_id}-${item.candidate_id}`} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2">
                                <div>
                                  <div className="font-medium text-slate-900">{item.candidate_name}</div>
                                  <div className="text-xs text-slate-500">{item.recruiter_name} • {item.recruiter_code}</div>
                                </div>
                                <div className="text-xs text-slate-500">{item.association_status}</div>
                              </div>
                            ))}
                            {((roleSubmissions[role.id]?.under_consideration || []).length === 0) && (
                              <div className="text-xs text-slate-500">No items</div>
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <XCircle className="w-4 h-4 text-rose-600" />
                            <span className="text-sm font-semibold text-slate-700">Rejected / Discarded</span>
                          </div>
                          <div className="space-y-2">
                            {(roleSubmissions[role.id]?.rejected || []).map((item) => (
                              <div key={`${item.association_id}-${item.candidate_id}`} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2">
                                <div>
                                  <div className="font-medium text-slate-900">{item.candidate_name}</div>
                                  <div className="text-xs text-slate-500">{item.recruiter_name} • {item.recruiter_code}</div>
                                </div>
                                <div className="text-xs text-slate-500">{item.association_status}</div>
                              </div>
                            ))}
                            {((roleSubmissions[role.id]?.rejected || []).length === 0) && (
                              <div className="text-xs text-slate-500">No items</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ));
            })()}
          </div>
        )}
      </div>

      {isExportOpen && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white w-full max-w-3xl rounded-xl shadow-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-slate-800">Export Roles</h3>
              <button
                onClick={() => setIsExportOpen(false)}
                className="p-2 rounded-md hover:bg-slate-100"
                title="Close"
              >
                <XCircle className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-72 overflow-auto">
              {allExportFields.map((f) => (
                <label key={f} className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={exportFields.includes(f)}
                    onChange={() => toggleField(f)}
                  />
                  <span className="text-sm text-slate-700">{fieldLabels[f] || f}</span>
                </label>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={selectAllFields}
                className="px-3 py-2 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                Select All
              </button>
              <button
                onClick={clearAllFields}
                className="px-3 py-2 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                Clear
              </button>
            </div>
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Preset name"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                <button
                  onClick={savePreset}
                  className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                >
                  Save Preset
                </button>
              </div>
              {exportPresets.length > 0 && (
                <div className="flex items-center gap-2">
                  <select
                    onChange={(e) => applyPresetByName(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    defaultValue=""
                  >
                    <option value="">Apply Preset</option>
                    {exportPresets.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      const name = presetName.trim();
                      if (name) deletePresetByName(name);
                    }}
                    className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  >
                    Delete Preset
                  </button>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setIsExportOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={exportSelectedCsv}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                title="Export Selected"
              >
                <Download className="w-4 h-4" />
                Export Selected
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Details Modal */}
      <RoleDetailsModal 
        role={selectedRole} 
        onClose={() => setSelectedRole(null)} 
      />
      {showAddModal && addClient && (
        <AddSubmissionModal
          client={addClient}
          onClose={() => { setShowAddModal(false); setAddClient(null); }}
          onSuccess={() => fetchRoles()}
        />
      )}
    </div>
  );
}
