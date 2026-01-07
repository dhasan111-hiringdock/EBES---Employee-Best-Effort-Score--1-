import { useState, useEffect } from "react";
import { Briefcase, Search, CheckCircle, XCircle, Users, TrendingUp, UserX, Send, Download, Bell, Clock } from "lucide-react";
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
  client_submitted?: number;
  client_rejected?: number;
  days_open?: number;
  first_submission_days?: number | null;
  first_interview_days?: number | null;
  created_at: string;
}

export default function RecruiterRoles() {
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<'recent' | 'title' | 'client' | 'team' | 'status'>('recent');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [hoveredRole, setHoveredRole] = useState<number | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [clients, setClients] = useState<Array<{ id: number; name: string; client_code: string; team_id?: number; team_name?: string }>>([]);
  const [teams, setTeams] = useState<Array<{ id: number; name: string; team_code: string }>>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | ''>('');
  const [selectedTeamId, setSelectedTeamId] = useState<number | ''>('');
  const [companySla, setCompanySla] = useState<{ sla_rm_eval_days: number; sla_submitted_days: number; sla_client_feedback_days: number } | null>(null);
  const [openReminderRoleId, setOpenReminderRoleId] = useState<number | null>(null);
  const [remindersRoleDisabled, setRemindersRoleDisabled] = useState<Record<number, boolean>>({});
  const [remindersClientDisabled, setRemindersClientDisabled] = useState<Record<string, boolean>>({});
  const [remindersRoleSnooze, setRemindersRoleSnooze] = useState<Record<number, string>>({});
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
    const loadSettings = async () => {
      try {
        const res = await fetchWithAuth('/api/company/settings');
        if (res && res.ok) {
          const data = await res.json();
          setCompanySla({
            sla_rm_eval_days: data.sla_rm_eval_days,
            sla_submitted_days: data.sla_submitted_days,
            sla_client_feedback_days: data.sla_client_feedback_days
          });
        }
      } catch {}
      try {
        const rd = localStorage.getItem('rolesRemindersRoleDisabled');
        const rc = localStorage.getItem('rolesRemindersClientDisabled');
        const rs = localStorage.getItem('rolesRemindersRoleSnooze');
        if (rd) setRemindersRoleDisabled(JSON.parse(rd));
        if (rc) setRemindersClientDisabled(JSON.parse(rc));
        if (rs) setRemindersRoleSnooze(JSON.parse(rs));
      } catch {}
    };
    loadSettings();
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

  const setRoleReminderDisabled = (roleId: number, disabled: boolean) => {
    setRemindersRoleDisabled((prev) => {
      const next = { ...prev, [roleId]: disabled };
      try { localStorage.setItem('rolesRemindersRoleDisabled', JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const setClientReminderDisabled = (clientName: string, disabled: boolean) => {
    setRemindersClientDisabled((prev) => {
      const next = { ...prev, [clientName]: disabled };
      try { localStorage.setItem('rolesRemindersClientDisabled', JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const setRoleReminderSnooze = (roleId: number, days: number) => {
    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    setRemindersRoleSnooze((prev) => {
      const next = { ...prev, [roleId]: until };
      try { localStorage.setItem('rolesRemindersRoleSnooze', JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const clearRoleReminderSnooze = (roleId: number) => {
    setRemindersRoleSnooze((prev) => {
      const next = { ...prev };
      delete next[roleId];
      try { localStorage.setItem('rolesRemindersRoleSnooze', JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const getSnoozeLabel = (roleId: number) => {
    const iso = remindersRoleSnooze[roleId];
    if (!iso) return '';
    const until = new Date(iso).getTime();
    const now = Date.now();
    const diffDays = Math.max(0, Math.ceil((until - now) / (24 * 60 * 60 * 1000)));
    return diffDays > 0 ? `${diffDays}d snoozed` : '';
  };

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
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusColors[role.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`} title={statusLabels[role.status] || role.status}>
                        {statusLabels[role.status] || role.status}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenReminderRoleId(openReminderRoleId === role.id ? null : role.id); }}
                        className="ml-auto px-2 py-1 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
                        title="Reminder controls"
                      >
                        <Bell className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="ml-13 space-y-1 text-sm">
                      <p className="text-slate-600">
                        <span className="text-slate-400">Client:</span> {role.client_name} • {role.team_name}
                      </p>
                      <p className="text-slate-600">
                        <span className="text-slate-400">Account Manager:</span> {role.account_manager_name}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {typeof role.days_open === 'number' && (
                          <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-xs flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {role.days_open}d open
                          </span>
                        )}
                        {typeof role.first_submission_days === 'number' && role.first_submission_days !== null && (
                          <span className="px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs">first sub {role.first_submission_days}d</span>
                        )}
                        {typeof role.first_interview_days === 'number' && role.first_interview_days !== null && (
                          <span className="px-2 py-1 rounded-md bg-purple-50 text-purple-700 text-xs">first interview {role.first_interview_days}d</span>
                        )}
                        {companySla && (
                          <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs">
                            target submit ≤ {companySla.sla_submitted_days}d • feedback ≤ {companySla.sla_client_feedback_days}d
                          </span>
                        )}
                        {(remindersRoleDisabled[role.id] || remindersClientDisabled[role.client_name] || getSnoozeLabel(role.id)) && (
                          <span className="px-2 py-1 rounded-md bg-yellow-50 text-yellow-700 text-xs">
                            {remindersRoleDisabled[role.id] ? 'role reminders off' : remindersClientDisabled[role.client_name] ? 'client reminders off' : getSnoozeLabel(role.id)}
                          </span>
                        )}
                      </div>
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
                          <div className="bg-white rounded-lg p-3 border border-emerald-100">
                            <div className="flex items-center gap-2 mb-1">
                              <CheckCircle className="w-4 h-4 text-emerald-600" />
                              <span className="text-xs text-slate-600 font-medium">Client Submitted</span>
                            </div>
                            <p className="text-lg font-bold text-emerald-600">{role.client_submitted || 0}</p>
                            <p className="text-xs text-slate-500 mt-1">Under client evaluation</p>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-rose-100">
                            <div className="flex items-center gap-2 mb-1">
                              <XCircle className="w-4 h-4 text-rose-600" />
                              <span className="text-xs text-slate-600 font-medium">Client Rejected</span>
                            </div>
                            <p className="text-lg font-bold text-rose-600">{role.client_rejected || 0}</p>
                            <p className="text-xs text-slate-500 mt-1">Rejected by client</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  {openReminderRoleId === role.id && (
                    <div className="absolute right-4 top-4 bg-white border border-slate-200 rounded-lg shadow-lg p-3 z-20" onClick={(e) => e.stopPropagation()}>
                      <p className="text-xs font-semibold text-slate-700 mb-2">Reminder controls</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => { setRoleReminderSnooze(role.id, 1); setOpenReminderRoleId(null); }} className="px-2 py-1 text-xs rounded-md border border-slate-300 hover:bg-slate-50">Snooze 1d</button>
                        <button onClick={() => { setRoleReminderSnooze(role.id, 3); setOpenReminderRoleId(null); }} className="px-2 py-1 text-xs rounded-md border border-slate-300 hover:bg-slate-50">Snooze 3d</button>
                        <button onClick={() => { setRoleReminderSnooze(role.id, 7); setOpenReminderRoleId(null); }} className="px-2 py-1 text-xs rounded-md border border-slate-300 hover:bg-slate-50">Snooze 7d</button>
                        <button onClick={() => { clearRoleReminderSnooze(role.id); setOpenReminderRoleId(null); }} className="px-2 py-1 text-xs rounded-md border border-slate-300 hover:bg-slate-50">Clear Snooze</button>
                      </div>
                      <div className="grid grid-cols-1 gap-2 mt-2">
                        <button onClick={() => { setRoleReminderDisabled(role.id, true); setOpenReminderRoleId(null); }} className="px-2 py-1 text-xs rounded-md border border-slate-300 hover:bg-slate-50">Disable for role</button>
                        <button onClick={() => { setClientReminderDisabled(role.client_name, true); setOpenReminderRoleId(null); }} className="px-2 py-1 text-xs rounded-md border border-slate-300 hover:bg-slate-50">Disable for client</button>
                        <button onClick={() => { setRoleReminderDisabled(role.id, false); setClientReminderDisabled(role.client_name, false); setOpenReminderRoleId(null); }} className="px-2 py-1 text-xs rounded-md border border-slate-300 hover:bg-slate-50">Enable reminders</button>
                      </div>
                    </div>
                  )}
                </div>
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
    </div>
  );
}
