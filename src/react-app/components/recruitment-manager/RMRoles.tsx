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
  Download,
  Bell,
  Calendar,
  User,
  Plus,
  Edit,
  UserPlus,
  Send
} from 'lucide-react';
import { fetchWithAuth, rmDiscardCandidate, rmSendCandidateToAM, rmReviewSubmission, rmReviewByRoleCandidate, rmUpdateRoleStatus } from '@/react-app/utils/api';
import CreateRoleModal from './CreateRoleModal';
import EditRoleModal from './EditRoleModal';
import AssignRecruiterModal from './AssignRecruiterModal';
import { Save } from 'lucide-react';
                            
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
  total_deals?: number;
  total_candidates?: number;
  active_candidates?: number;
  discarded_candidates?: number;
  client_submitted?: number;
  days_open?: number;
  first_submission_days?: number | null;
  first_interview_days?: number | null;
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
  const [, setAcceptOpen] = useState<Record<number, boolean>>({});
  const submissionsRef = useRef<HTMLDivElement | null>(null);
  const [detailsTab, setDetailsTab] = useState<'role' | 'submissions'>('submissions');
  const [sortKey, setSortKey] = useState<'recent' | 'title' | 'client' | 'team' | 'status'>('recent');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
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
  const [statusDialog, setStatusDialog] = useState<{ roleId: number; current: string } | null>(null);
  const [statusValue, setStatusValue] = useState<string>('');
  
  const pendingEvalCount = submissions.pending_evaluation?.length || 0;

  useEffect(() => {
    fetchInitialData();
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
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetchWithAuth(`/api/rm/roles?${params.toString()}`);
      
      if (response.ok) {
        const data = await response.json();
        setRoles(data);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  }, [activeTab, clientFilter, teamFilter, searchTerm]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  useEffect(() => {
    try {
      const presetsStr = localStorage.getItem('rmRolesExportPresets');
      if (presetsStr) {
        const parsed = JSON.parse(presetsStr);
        if (Array.isArray(parsed)) setExportPresets(parsed);
      }
      const lastFieldsStr = localStorage.getItem('rmRolesExportLastFields');
      if (lastFieldsStr) {
        const arr = JSON.parse(lastFieldsStr);
        if (Array.isArray(arr) && arr.length > 0) {
          setExportFields(arr.filter((f: string) => allExportFields.includes(f)));
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const saved = localStorage.getItem('rmRolesFilters');
        if (saved) {
          const f = JSON.parse(saved);
          if (f.activeTab === 'active' || f.activeTab === 'non-active') setActiveTab(f.activeTab);
          if (typeof f.clientFilter === 'string') setClientFilter(f.clientFilter);
          if (typeof f.teamFilter === 'string') setTeamFilter(f.teamFilter);
          if (typeof f.searchTerm === 'string') setSearchTerm(f.searchTerm);
          if (['recent','title','client','team','status'].includes(f.sortKey)) setSortKey(f.sortKey);
          if (f.sortOrder === 'asc' || f.sortOrder === 'desc') setSortOrder(f.sortOrder);
        }
      } catch {}
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
        const rd = localStorage.getItem('rmRolesRemindersRoleDisabled');
        const rc = localStorage.getItem('rmRolesRemindersClientDisabled');
        const rs = localStorage.getItem('rmRolesRemindersRoleSnooze');
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
        clientFilter,
        teamFilter,
        searchTerm,
        sortKey,
        sortOrder
      };
      localStorage.setItem('rmRolesFilters', JSON.stringify(payload));
    } catch {}
  }, [activeTab, clientFilter, teamFilter, searchTerm, sortKey, sortOrder]);

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
        localStorage.setItem('rmRolesExportPresets', JSON.stringify(next));
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
        localStorage.setItem('rmRolesExportPresets', JSON.stringify(next));
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
              return String(r.client_submitted || r.under_client_evaluation || 0);
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
    a.download = `rm-roles-${activeTab}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    try {
      localStorage.setItem('rmRolesExportLastFields', JSON.stringify(fields));
    } catch {}
    setIsExportOpen(false);
  };

  const setRoleReminderDisabled = (roleId: number, disabled: boolean) => {
    setRemindersRoleDisabled((prev) => {
      const next = { ...prev, [roleId]: disabled };
      try { localStorage.setItem('rmRolesRemindersRoleDisabled', JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const setClientReminderDisabled = (clientName: string, disabled: boolean) => {
    setRemindersClientDisabled((prev) => {
      const next = { ...prev, [clientName]: disabled };
      try { localStorage.setItem('rmRolesRemindersClientDisabled', JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const setRoleReminderSnooze = (roleId: number, days: number) => {
    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    setRemindersRoleSnooze((prev) => {
      const next = { ...prev, [roleId]: until };
      try { localStorage.setItem('rmRolesRemindersRoleSnooze', JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const clearRoleReminderSnooze = (roleId: number) => {
    setRemindersRoleSnooze((prev) => {
      const next = { ...prev };
      delete next[roleId];
      try { localStorage.setItem('rmRolesRemindersRoleSnooze', JSON.stringify(next)); } catch {}
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
  

  const filteredRoles = (() => {
    const base = roles.filter(role => {
      const q = searchTerm.toLowerCase();
      const matchesSearch = 
        (role.title || '').toLowerCase().includes(q) ||
        (role.role_code || '').toLowerCase().includes(q) ||
        (role.client_name || '').toLowerCase().includes(q) ||
        (role.team_name || '').toLowerCase().includes(q);
      return matchesSearch;
    });
    const statusWeight = (s: string) => {
      if (s === 'deal') return 5;
      if (s === 'active') return 4;
      if (s === 'on_hold') return 3;
      if (s === 'lost') return 2;
      if (s === 'cancelled') return 1;
      return 0;
    };
    const sorted = [...base].sort((a, b) => {
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
    return sorted;
  })();

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

  const [noteDialog, setNoteDialog] = useState<{ roleId: number; candidateId: number; submissionId?: number } | null>(null);
  const [noteText, setNoteText] = useState<string>("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const quickReasons = [
    "Not a fit",
    "Lack of required skills",
    "Better candidate found",
    "Recruiter error",
    "Client request"
  ];

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

  const confirmDiscard = async () => {
    if (!noteDialog) return;
    if (!noteText.trim()) {
      setNoteError("Please add a note");
      return;
    }
    try {
      const res = await rmDiscardCandidate(noteDialog.roleId, noteDialog.candidateId, noteText || undefined);
      if (res.ok && selectedRole) {
        await loadRoleSubmissions(selectedRole.id);
      }
    } finally {
      setNoteDialog(null);
      setNoteText("");
      setNoteError(null);
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
            onClick={openExport}
            className="flex items-center gap-2 px-6 py-3 border border-slate-300 bg-white text-slate-700 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
            title="Export CSV"
          >
            <Download className="w-5 h-5" />
            Export
          </button>
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
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-2">Sort</label>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as any)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all appearance-none bg-white"
              >
                <option value="recent">Recent</option>
                <option value="title">Title</option>
                <option value="client">Client</option>
                <option value="team">Team</option>
                <option value="status">Status</option>
              </select>
            </div>
            <div className="w-28">
              <label className="block text-sm font-medium text-slate-700 mb-2">Order</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all appearance-none bg-white"
              >
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </select>
            </div>
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

                <div className="ml-0 space-y-1 text-sm">
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
                </div>

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
                    onClick={(e) => { e.stopPropagation(); setOpenReminderRoleId(openReminderRoleId === role.id ? null : role.id); }}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                    title="Reminder controls"
                  >
                    <Bell className="w-3 h-3" />
                    Reminders
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
                {openReminderRoleId === role.id && (
                  <div className="relative">
                    <div className="absolute right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg p-3 z-20">
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
                  </div>
                )}
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
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setStatusDialog({ roleId: role.id, current: role.status });
                              setStatusValue(role.status);
                            }}
                            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Change Status"
                          >
                            <Briefcase className="w-4 h-4" />
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

      {isExportOpen && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white w_full max-w-3xl rounded-xl shadow-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-slate-800">Export Roles</h3>
              <button
                onClick={() => setIsExportOpen(false)}
                className="p-2 rounded-md hover:bg-slate-100"
                title="Close"
              >
                <X className="w-5 h-5 text-slate-600" />
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

      {statusDialog && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white w-full max-w-md rounded-xl shadow-lg border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-3">Change Role Status</h3>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              value={statusValue}
              onChange={(e) => setStatusValue(e.target.value)}
            >
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="lost">Lost</option>
              <option value="no_answer">No Answer</option>
              <option value="cancelled">Cancelled</option>
              <option value="deal">Deal</option>
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => { setStatusDialog(null); setStatusValue(''); }}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const dlg = statusDialog;
                  if (!dlg) return;
                  try {
                    const res = await rmUpdateRoleStatus(dlg.roleId, statusValue || dlg.current);
                    if (res.ok) {
                      await fetchRoles();
                      if (selectedRole && selectedRole.id === dlg.roleId) {
                        const updated = roles.find(r => r.id === dlg.roleId);
                        if (updated) setSelectedRole(updated);
                      }
                    } else {
                      try {
                        const j = await res.json();
                        alert(j?.error || 'Failed to update status');
                      } catch {
                        alert('Failed to update status');
                      }
                    }
                  } finally {
                    setStatusDialog(null);
                    setStatusValue('');
                  }
                }}
                className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg"
              >
                Save
              </button>
            </div>
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

                {/* Submissions in Play */}
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 border-2 border-indigo-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-indigo-100 rounded-lg p-2">
                      <Send className="w-6 h-6 text-indigo-600" />
                    </div>
                    <label className="text-lg font-semibold text-indigo-900">Submissions in Play</label>
                  </div>
                  <p className="text-5xl font-bold text-indigo-600">{selectedRole.in_play_submissions || 0}</p>
                  <p className="text-sm text-indigo-700 mt-2">Active candidates being tracked</p>
                </div>

                {/* Role Statistics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="bg-blue-100 rounded-lg p-2">
                        <Send className="w-5 h-5 text-blue-600" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-blue-600">{selectedRole.total_submissions || 0}</p>
                    <p className="text-xs text-slate-600 mt-1 font-medium">Total Submissions</p>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="bg-purple-100 rounded-lg p-2">
                        <Users className="w-5 h-5 text-purple-600" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-purple-600">{selectedRole.total_interviews || 0}</p>
                    <p className="text-xs text-slate-600 mt-1 font-medium">Interviews</p>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="bg-emerald-100 rounded-lg p-2">
                        <TrendingUp className="w-5 h-5 text-emerald-600" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-emerald-600">{selectedRole.status === 'deal' ? 1 : 0}</p>
                    <p className="text-xs text-slate-600 mt-1 font-medium">Deals</p>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="bg-indigo-100 rounded-lg p-2">
                        <Users className="w-5 h-5 text-indigo-600" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-indigo-600">{selectedRole.in_play_submissions || 0}</p>
                    <p className="text-xs text-slate-600 mt-1 font-medium">Candidates</p>
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
                    <p className="text-3xl font-bold text-green-600">{submissions.under_consideration.length || 0}</p>
                    <p className="text-xs text-slate-500 mt-1">Still in process</p>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-5 border border-red-200">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="bg-red-100 rounded-lg p-2">
                        <XCircle className="w-5 h-5 text-red-600" />
                      </div>
                      <label className="text-sm font-semibold text-slate-600">Discarded</label>
                    </div>
                    <p className="text-3xl font-bold text-red-600">{(submissions.rejected || []).filter((r: any) => (r as any).is_discarded === 1).length}</p>
                    <p className="text-xs text-slate-500 mt-1">Not suitable</p>
                  </div>
                </div>

                {/* Client Flow */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="bg-emerald-100 rounded-lg p-2">
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                      </div>
                      <label className="text-sm font-semibold text-slate-600">Client Submitted</label>
                    </div>
                    <p className="text-3xl font-bold text-emerald-600">{selectedRole.under_client_evaluation || 0}</p>
                    <p className="text-xs text-slate-500 mt-1">Under client evaluation</p>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="bg-red-100 rounded-lg p-2">
                        <XCircle className="w-5 h-5 text-red-600" />
                      </div>
                      <label className="text-sm font-semibold text-slate-600">Client Rejected</label>
                    </div>
                    <p className="text-3xl font-bold text-red-600">{selectedRole.client_rejected || 0}</p>
                    <p className="text-xs text-slate-500 mt-1">Rejected by client</p>
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {submissions.pending_evaluation.map((item) => (
                                <div key={item.association_id} className="bg-white border border-slate-200 rounded-2xl shadow-sm">
                                  <div className="px-4 py-3 border-b border-slate-100">
                                    <div className="font-semibold text-slate-900">{item.candidate_name}</div>
                                    <div className="text-xs text-slate-500">{item.recruiter_name} · {item.recruiter_code}</div>
                                  </div>
                                  <div className="p-4 space-y-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      <div>
                                        <label className="text-xs font-medium text-slate-600">Validation</label>
                                        <input
                                          type="text"
                                          placeholder="Validation status"
                                          defaultValue={item.rm_validation_status || ''}
                                          onChange={(e) => updateReviewEdit((item.submission_id || item.association_id)!, 'rm_validation_status', e.target.value)}
                                          className="mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm w-full"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs font-medium text-slate-600">Contract Type</label>
                                        <select
                                          defaultValue={item.rm_work_type || ''}
                                          onChange={(e) => updateReviewEdit((item.submission_id || item.association_id)!, 'rm_work_type', e.target.value)}
                                          className="mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm w-full bg-white"
                                        >
                                          <option value="">Select contract type</option>
                                          <option value="SOW">SOW</option>
                                          <option value="Payroll">Payroll</option>
                                        </select>
                                      </div>
                                      <div>
                                        <label className="text-xs font-medium text-slate-600">Payment</label>
                                        <div className="relative mt-1">
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
                                      </div>
                                      <div>
                                        <label className="text-xs font-medium text-slate-600">Location</label>
                                        <input
                                          type="text"
                                          placeholder="Location"
                                          defaultValue={item.rm_location || ''}
                                          onChange={(e) => updateReviewEdit((item.submission_id || item.association_id)!, 'rm_location', e.target.value)}
                                          className="mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm w-full"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs font-medium text-slate-600">Score (0–5)</label>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min={0}
                                          max={5}
                                          placeholder="Validation score"
                                          defaultValue={(item as any).score != null ? String((item as any).score) : ''}
                                          onChange={(e) => updateReviewEdit((item.submission_id || item.association_id)!, 'rm_score_0_5', e.target.value)}
                                          className="mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm w-full"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs font-medium text-slate-600">Notes</label>
                                        <input
                                          type="text"
                                          placeholder="Notes"
                                          defaultValue={item.rm_notes || ''}
                                          onChange={(e) => updateReviewEdit((item.submission_id || item.association_id)!, 'rm_notes', e.target.value)}
                                          className="mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm w-full"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                  <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => saveReview(item.submission_id, selectedRole!.id, item.candidate_id, item.association_id)}
                                      className="px-3 py-2 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => sendToAM(selectedRole!.id, item.candidate_id, item.submission_id, item.association_id)}
                                      className="px-3 py-2 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                                    >
                                      Send to AM
                                    </button>
                                    <button
                                      onClick={() => setNoteDialog({ roleId: selectedRole!.id, candidateId: item.candidate_id, submissionId: item.submission_id })}
                                      className="px-3 py-2 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50">
                                <th className="text-left py-2 px-3 text-xs font-semibold text-slate-700">Candidate</th>
                                <th className="text-left py-2 px-3 text-xs font-semibold text-slate-700">Location</th>
                                <th className="text-left py-2 px-3 text-xs font-semibold text-slate-700">Contract Type</th>
                                <th className="text-left py-2 px-3 text-xs font-semibold text-slate-700">Payment</th>
                                <th className="text-left py-2 px-3 text-xs font-semibold text-slate-700">Score (0–5)</th>
                                <th className="text-left py-2 px-3 text-xs font-semibold text-slate-700">Submitted</th>
                                <th className="text-left py-2 px-3 text-xs font-semibold text-slate-700">RM Validation</th>
                                <th className="text-left py-2 px-3 text-xs font-semibold text-slate-700">Status</th>
                                <th className="text-right py-2 px-3 text-xs font-semibold text-slate-700">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[...submissions.under_consideration, ...submissions.rejected].map((row) => (
                                <tr key={row.association_id} className="border-b border-slate-100 hover:bg-slate-50">
                                  <td className="py-2 px-3">
                                    <div className="font-medium text-slate-900">{row.candidate_name || "Unknown"}</div>
                                    <div className="text-xs text-slate-500">
                                      {row.recruiter_name} · {row.recruiter_code}
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 text-sm text-slate-700">{row.rm_location || "-"}</td>
                                  <td className="py-2 px-3 text-sm text-slate-700">{row.rm_work_type || "-"}</td>
                                  <td className="py-2 px-3 text-sm text-slate-700" title={`Contract: ${row.rm_work_type || "-"} • Unit: ${((row.rm_work_type || '').toLowerCase() === 'payroll' ? 'annually' : (row.rm_work_type || '').toLowerCase() === 'sow' ? 'per day' : '') || '-'}`}>
                                    {row.rm_rate_bill != null ? `€${Number(row.rm_rate_bill)} ${((row.rm_work_type || '').toLowerCase() === 'payroll' ? 'annually' : (row.rm_work_type || '').toLowerCase() === 'sow' ? 'per day' : '') || ''}` : "-"}
                                  </td>
                                  <td className="py-2 px-3 text-sm text-slate-700">{(row as any).score != null ? Number((row as any).score).toFixed(2) : "-"}</td>
                                  <td className="py-2 px-3 text-sm text-slate-700">{row.submission_date?.slice(0, 10) || "-"}</td>
                                  <td className="py-2 px-3 text-sm text-slate-700">{row.rm_validation_status || "-"}</td>
                                  <td className="py-2 px-3 text-sm">
                                    {(() => {
                                      if (row.is_discarded === 1) return <span className="px-2 py-1 text-xs rounded border border-red-200 bg-red-50 text-red-700">Discarded</span>;
                                      if (row.association_status === "client_submitted") return <span className="px-2 py-1 text-xs rounded border border-blue-200 bg-blue-50 text-blue-700">Submitted to Client</span>;
                                      if (row.association_status === "client_rejected") return <span className="px-2 py-1 text-xs rounded border border-gray-200 bg-gray-50 text-gray-700">Client Rejected</span>;
                                      if (row.association_status === "deal") return <span className="px-2 py-1 text-xs rounded border border-green-200 bg-green-50 text-green-700">Deal</span>;
                                      if (row.association_status === "submitted") return <span className="px-2 py-1 text-xs rounded border border-yellow-200 bg-yellow-50 text-yellow-700">Submitted to AM</span>;
                                      return <span className="px-2 py-1 text-xs rounded border border-emerald-200 bg-emerald-50 text-emerald-700">In Play</span>;
                                    })()}
                                  </td>
                                  <td className="py-2 px-3 text-right">
                                    {row.is_discarded !== 1 ? (
                                      <div className="flex items-center justify-end gap-2">
                                        {row.association_status === 'rm_evaluation' && (
                                          <button
                                            onClick={() => sendToAM(selectedRole!.id, row.candidate_id!, row.submission_id, row.association_id)}
                                            className="text-xs px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                                          >
                                            Send to AM
                                          </button>
                                        )}
                                        <button
                                          className="text-xs px-3 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50"
                                          onClick={() => setNoteDialog({ roleId: selectedRole!.id, candidateId: row.candidate_id!, submissionId: row.submission_id })}
                                        >
                                          Reject
                                        </button>
                                        <button
                                          onClick={() => saveReview(row.submission_id)}
                                          disabled={!row.submission_id}
                                          className="text-xs px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1 justify-center"
                                        >
                                          <Save className="w-4 h-4" />
                                          Save
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-slate-400">—</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
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
      {noteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-md p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Reject Candidate</h3>
            <p className="text-sm text-gray-600 mb-3">Add a note</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {quickReasons.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setNoteText((prev) => (prev ? `${prev} ${r}` : r))}
                  className="px-2 py-1 text-xs rounded-full border border-gray-300 hover:bg-gray-50"
                >
                  {r}
                </button>
              ))}
            </div>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              rows={4}
              value={noteText}
              onChange={(e) => {
                setNoteText(e.target.value);
                setNoteError(null);
              }}
              placeholder="Reason or details"
            />
            {noteError && <div className="mt-2 text-xs text-red-600">{noteError}</div>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setNoteDialog(null); setNoteText(""); setNoteError(null); }} className="px-3 py-2 text-sm border border-gray-200 rounded-lg">Cancel</button>
              <button disabled={!noteText.trim()} onClick={confirmDiscard} className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg disabled:opacity-50">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
