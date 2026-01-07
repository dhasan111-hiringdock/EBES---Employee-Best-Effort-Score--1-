import { useState, useEffect } from "react";
import { Users, Search, UserCheck, UserX, Eye, Trash2, RotateCcw, Briefcase, Edit, Download, Copy, ExternalLink, XCircle } from "lucide-react";
import { fetchWithAuth } from "@/react-app/utils/api";
import EditCandidateModal from "@/react-app/components/recruiter/EditCandidateModal";

interface Candidate {
  id: number;
  candidate_code: string;
  name: string;
  email: string;
  phone: string;
  resume_url: string;
  notes: string;
  is_active: number;
  created_at: string;
  total_associations: number;
  active_associations: number;
  discarded_associations: number;
}

interface Association {
  id: number;
  role_id: number;
  role_code: string;
  role_title: string;
  role_status: string;
  client_name: string;
  client_code: string;
  team_name: string;
  status: string;
  submission_date: string;
  is_discarded: number;
  discarded_at: string;
  discarded_reason: string;
  recruiter_name: string;
  recruiter_code: string;
}

export default function RecruiterCandidates() {
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [candidateDetails, setCandidateDetails] = useState<{ candidate: Candidate; associations: Association[] } | null>(null);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [assocSearch, setAssocSearch] = useState<string>('');
  const [assocSortKey, setAssocSortKey] = useState<'recent' | 'status' | 'client' | 'team' | 'role'>('recent');
  const [assocSortOrder, setAssocSortOrder] = useState<'asc' | 'desc'>('desc');
  const [assocStatusFilter, setAssocStatusFilter] = useState<'all' | 'rm_evaluation' | 'submitted' | 'client_submitted' | 'client_rejected' | 'deal' | 'discarded'>('all');
  const [assocHideDiscarded, setAssocHideDiscarded] = useState<boolean>(false);
  const assocAllExportFields = [
    'role_code',
    'role_title',
    'client_name',
    'team_name',
    'status',
    'is_discarded',
    'discarded_reason',
    'submission_date',
    'recruiter_name',
    'recruiter_code'
  ];
  const assocFieldLabels: Record<string, string> = {
    role_code: 'Role Code',
    role_title: 'Role Title',
    client_name: 'Client',
    team_name: 'Team',
    status: 'Status',
    is_discarded: 'Discarded',
    discarded_reason: 'Discard Reason',
    submission_date: 'Submission Date',
    recruiter_name: 'Recruiter Name',
    recruiter_code: 'Recruiter Code'
  };
  const [isAssocExportOpen, setIsAssocExportOpen] = useState(false);
  const [assocExportFields, setAssocExportFields] = useState<string[]>(assocAllExportFields);
  const [assocExportPresets, setAssocExportPresets] = useState<Array<{ name: string; fields: string[] }>>([]);
  const [assocPresetName, setAssocPresetName] = useState('');
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [discardReason, setDiscardReason] = useState('');
  const [discardTarget, setDiscardTarget] = useState<{ type: 'candidate' | 'association'; candidateId: number; roleId?: number } | null>(null);

  useEffect(() => {
    fetchCandidates();
  }, [activeTab, searchQuery]);

  useEffect(() => {
    try {
      const p = localStorage.getItem('candidateAssocExportPresets');
      if (p) {
        const parsed = JSON.parse(p);
        if (Array.isArray(parsed)) setAssocExportPresets(parsed);
      }
      const last = localStorage.getItem('candidateAssocExportLastFields');
      if (last) {
        const f = JSON.parse(last);
        if (Array.isArray(f) && f.length > 0) setAssocExportFields(f.filter((x: string) => assocAllExportFields.includes(x)));
      }
    } catch {}
  }, []);

  const openAssocExport = () => {
    setIsAssocExportOpen(true);
  };
  const toggleAssocField = (f: string) => {
    setAssocExportFields((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  };
  const selectAllAssocFields = () => setAssocExportFields(assocAllExportFields);
  const clearAllAssocFields = () => setAssocExportFields([]);
  const saveAssocPreset = () => {
    const name = assocPresetName.trim();
    if (!name) return;
    setAssocExportPresets((prev) => {
      const filtered = prev.filter((p) => p.name !== name);
      const next = [...filtered, { name, fields: assocExportFields }];
      try { localStorage.setItem('candidateAssocExportPresets', JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const applyAssocPresetByName = (name: string) => {
    const p = assocExportPresets.find((x) => x.name === name);
    if (!p) return;
    setAssocExportFields(p.fields.filter((f) => assocAllExportFields.includes(f)));
  };
  const deleteAssocPresetByName = (name: string) => {
    setAssocExportPresets((prev) => {
      const next = prev.filter((p) => p.name !== name);
      try { localStorage.setItem('candidateAssocExportPresets', JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const exportAssocSelectedCsv = () => {
    if (!candidateDetails) return;
    const fields = assocExportFields.length > 0 ? assocExportFields : assocAllExportFields;
    const headers = fields;
    const term = assocSearch.trim().toLowerCase();
    const filteredByTerm = term
      ? candidateDetails.associations.filter((a) => {
          const role = (a.role_title || '').toLowerCase();
          const code = (a.role_code || '').toLowerCase();
          const client = (a.client_name || '').toLowerCase();
          const team = (a.team_name || '').toLowerCase();
          return role.includes(term) || code.includes(term) || client.includes(term) || team.includes(term);
        })
      : candidateDetails.associations;
    const filteredByStatus = assocStatusFilter === 'all'
      ? filteredByTerm
      : filteredByTerm.filter((a) => {
          if (assocStatusFilter === 'discarded') return a.is_discarded === 1;
          return (a.status || '') === assocStatusFilter && a.is_discarded !== 1;
        });
    const filteredFinal = assocHideDiscarded
      ? filteredByStatus.filter((a) => a.is_discarded !== 1)
      : filteredByStatus;
    const rows = filteredFinal.map((a) =>
      fields.map((f) => {
        switch (f) {
          case 'role_code': return (a.role_code || '').replace(/,/g, ' ');
          case 'role_title': return (a.role_title || '').replace(/,/g, ' ');
          case 'client_name': return (a.client_name || '').replace(/,/g, ' ');
          case 'team_name': return (a.team_name || '').replace(/,/g, ' ');
          case 'status': return a.status || '';
          case 'is_discarded': return String(a.is_discarded || 0);
          case 'discarded_reason': return (a.discarded_reason || '').replace(/,/g, ' ');
          case 'submission_date': return a.submission_date || '';
          case 'recruiter_name': return (a.recruiter_name || '').replace(/,/g, ' ');
          case 'recruiter_code': return (a.recruiter_code || '').replace(/,/g, ' ');
          default: return '';
        }
      }).join(',')
    );
    const csv = [headers.join(',')].concat(rows).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${candidateDetails.candidate.candidate_code}-associations.csv`;
    a.click();
    URL.revokeObjectURL(url);
    try { localStorage.setItem('candidateAssocExportLastFields', JSON.stringify(fields)); } catch {}
    setIsAssocExportOpen(false);
  };
  const fetchCandidates = async () => {
    try {
      setLoading(true);
      const isActive = activeTab === 'active' ? '1' : '0';
      const searchParam = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : '';
      const response = await fetchWithAuth(`/api/recruiter/candidates?is_active=${isActive}${searchParam}`);
      
      if (response.ok) {
        const data = await response.json();
        setCandidates(data);
      }
    } catch (error) {
      console.error('Failed to fetch candidates:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCandidateDetails = async (candidateId: number) => {
    try {
      const response = await fetchWithAuth(`/api/recruiter/candidates/${candidateId}`);
      if (response.ok) {
        const data = await response.json();
        setCandidateDetails(data);
      }
    } catch (error) {
      console.error('Failed to fetch candidate details:', error);
    }
  };

  const handleViewDetails = async (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    await fetchCandidateDetails(candidate.id);
  };

  const handleDiscardCandidate = async (candidateId: number) => {
    setDiscardTarget({ type: 'candidate', candidateId });
    setDiscardReason('');
    setShowDiscardModal(true);
  };

  const handleDiscardAssociation = async (candidateId: number, roleId: number) => {
    setDiscardTarget({ type: 'association', candidateId, roleId });
    setDiscardReason('');
    setShowDiscardModal(true);
  };

  const confirmDiscard = async () => {
    if (!discardTarget) return;

    try {
      if (discardTarget.type === 'candidate') {
        const response = await fetchWithAuth(`/api/recruiter/candidates/${discardTarget.candidateId}/discard`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: discardReason.trim() || null })
        });

        if (response.ok) {
          setShowDiscardModal(false);
          setSelectedCandidate(null);
          setCandidateDetails(null);
          fetchCandidates();
        }
      } else {
        const response = await fetchWithAuth(`/api/recruiter/candidates/${discardTarget.candidateId}/roles/${discardTarget.roleId}/discard`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: discardReason.trim() || null })
        });

        if (response.ok) {
          setShowDiscardModal(false);
          if (selectedCandidate) {
            await fetchCandidateDetails(selectedCandidate.id);
          }
        }
      }
    } catch (error) {
    }
  };

  const cancelDiscard = () => {
    setShowDiscardModal(false);
    setDiscardReason('');
    setDiscardTarget(null);
  };

  const handleRestoreCandidate = async (candidateId: number) => {
    try {
      const response = await fetchWithAuth(`/api/recruiter/candidates/${candidateId}/restore`, {
        method: 'POST'
      });

      if (response.ok) {
        setSelectedCandidate(null);
        setCandidateDetails(null);
        fetchCandidates();
      }
    } catch (error) {
      console.error('Failed to restore candidate:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Candidates</h2>
          <p className="text-slate-500 mt-1">Manage your candidate database</p>
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
            <UserCheck className="w-4 h-4" />
            Active Candidates
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
            <UserX className="w-4 h-4" />
            Inactive Candidates
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
            placeholder="Search candidates by name..."
            className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Candidates List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : candidates.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">
              {searchQuery
                ? `No candidates found for "${searchQuery}"`
                : `No ${activeTab} candidates yet`}
            </p>
            <p className="text-sm text-slate-500 mt-2">
              {searchQuery
                ? 'Try a different search term'
                : activeTab === 'active'
                ? 'Candidates will appear here when you add them via submissions'
                : 'Discarded candidates will appear here'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {candidates.map((candidate) => (
              <div
                key={candidate.id}
                className="p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-bold">
                        {candidate.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-800">{candidate.name}</h3>
                        <p className="text-sm text-slate-500 font-mono">{candidate.candidate_code}</p>
                      </div>
                    </div>
                    <div className="ml-13 space-y-1 text-sm text-slate-600">
                      {candidate.email && (
                        <p className="flex items-center gap-2">
                          <span className="text-slate-400">Email:</span>
                          {candidate.email}
                        </p>
                      )}
                      {candidate.phone && (
                        <p className="flex items-center gap-2">
                          <span className="text-slate-400">Phone:</span>
                          {candidate.phone}
                        </p>
                      )}
                      <div className="flex gap-4 mt-2">
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                          {candidate.total_associations} total submissions
                        </span>
                        <span className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs font-medium">
                          {candidate.active_associations} active
                        </span>
                        {candidate.discarded_associations > 0 && (
                          <span className="px-2 py-1 bg-red-50 text-red-700 rounded text-xs font-medium">
                            {candidate.discarded_associations} discarded
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {candidate.email && (
                      <button
                        onClick={() => navigator.clipboard.writeText(candidate.email)}
                        className="px-2 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2 font-medium"
                        title="Copy email"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    )}
                    {candidate.phone && (
                      <button
                        onClick={() => navigator.clipboard.writeText(candidate.phone)}
                        className="px-2 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2 font-medium"
                        title="Copy phone"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    )}
                    {candidate.resume_url && (
                      <a
                        href={candidate.resume_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2 font-medium"
                        title="Open resume"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      onClick={() => handleViewDetails(candidate)}
                      className="px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-2 font-medium"
                    >
                      <Eye className="w-4 h-4" />
                      View Details
                    </button>
                    {activeTab === 'active' ? (
                      <button
                        onClick={() => handleDiscardCandidate(candidate.id)}
                        className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2 font-medium"
                      >
                        <Trash2 className="w-4 h-4" />
                        Discard
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRestoreCandidate(candidate.id)}
                        className="px-4 py-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors flex items-center gap-2 font-medium"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Restore
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Candidate Details Modal */}
      {selectedCandidate && candidateDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5 flex justify-between items-center rounded-t-2xl">
              <div>
                <h3 className="text-2xl font-bold text-white">{candidateDetails.candidate.name}</h3>
                <p className="text-sm text-indigo-100 mt-1 font-mono">{candidateDetails.candidate.candidate_code}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingCandidate(candidateDetails.candidate)}
                  className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors flex items-center gap-2"
                  title="Edit candidate"
                >
                  <Edit className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    setSelectedCandidate(null);
                    setCandidateDetails(null);
                  }}
                  className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Contact Information */}
              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="font-semibold text-slate-800 mb-3">Contact Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-slate-500">Email:</span>
                    <p className="font-medium text-slate-800">{candidateDetails.candidate.email || 'Not provided'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Phone:</span>
                    <p className="font-medium text-slate-800">{candidateDetails.candidate.phone || 'Not provided'}</p>
                  </div>
                </div>
                {candidateDetails.candidate.notes && (
                  <div className="mt-3">
                    <span className="text-slate-500">Notes:</span>
                    <p className="text-slate-800 mt-1">{candidateDetails.candidate.notes}</p>
                  </div>
                )}
              </div>

              {/* Role Associations */}
            <div>
              <h4 className="font-semibold text-slate-800 mb-3">Role Submissions History</h4>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3 sticky top-0 z-10 bg-white">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={assocSearch}
                  onChange={(e) => setAssocSearch(e.target.value)}
                  placeholder="Search submissions"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={assocHideDiscarded}
                  onChange={(e) => setAssocHideDiscarded(e.target.checked)}
                />
                Hide discarded
              </label>
              <select
                value={assocSortKey}
                onChange={(e) => setAssocSortKey(e.target.value as any)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm w-full md:w-auto"
              >
                <option value="recent">Sort: Recent</option>
                <option value="status">Sort: Status</option>
                <option value="client">Sort: Client</option>
                <option value="team">Sort: Team</option>
                <option value="role">Sort: Role Title</option>
              </select>
              <select
                value={assocSortOrder}
                onChange={(e) => setAssocSortOrder(e.target.value as any)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm w-full md:w-auto"
              >
                <option value="desc">Order: Desc</option>
                <option value="asc">Order: Asc</option>
              </select>
              <select
                value={assocStatusFilter}
                onChange={(e) => setAssocStatusFilter(e.target.value as any)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm w-full md:w-auto"
                title="Filter by Status"
              >
                <option value="all">Filter: All</option>
                <option value="rm_evaluation">Pending Evaluation</option>
                <option value="submitted">Submitted to AM</option>
                <option value="client_submitted">Submitted to Client</option>
                <option value="client_rejected">Client Rejected</option>
                <option value="deal">Deal</option>
                <option value="discarded">Discarded</option>
              </select>
              <button
                onClick={openAssocExport}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                title="Export CSV"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              </div>
              {candidateDetails.associations.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-lg">
                  <Briefcase className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-slate-600">No role submissions yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(() => {
                    const term = assocSearch.trim().toLowerCase();
                    const filteredByTerm = term
                      ? candidateDetails.associations.filter((a) => {
                          const role = (a.role_title || '').toLowerCase();
                          const code = (a.role_code || '').toLowerCase();
                          const client = (a.client_name || '').toLowerCase();
                          const team = (a.team_name || '').toLowerCase();
                          return role.includes(term) || code.includes(term) || client.includes(term) || team.includes(term);
                        })
                      : candidateDetails.associations;
                    const filtered = assocStatusFilter === 'all'
                      ? filteredByTerm
                      : filteredByTerm.filter((a) => {
                          if (assocStatusFilter === 'discarded') return a.is_discarded === 1;
                          return (a.status || '') === assocStatusFilter && a.is_discarded !== 1;
                        });
                    const filteredFinal = assocHideDiscarded
                      ? filtered.filter((a) => a.is_discarded !== 1)
                      : filtered;
                    const statusWeight = (a: Association) => {
                      if (a.is_discarded) return -1;
                      const s = a.status || '';
                      if (s === 'deal') return 5;
                      if (s === 'client_submitted') return 4;
                      if (s === 'submitted') return 3;
                      if (s === 'rm_evaluation') return 2;
                      if (s === 'client_rejected') return 1;
                      return 0;
                    };
                    const sorted = [...filteredFinal].sort((a, b) => {
                      if (assocSortKey === 'status') {
                        const wa = statusWeight(a);
                        const wb = statusWeight(b);
                        return assocSortOrder === 'desc' ? wb - wa : wa - wb;
                      }
                      if (assocSortKey === 'client') {
                        const cmp = (a.client_name || '').localeCompare(b.client_name || '');
                        return assocSortOrder === 'desc' ? cmp : -cmp;
                      }
                      if (assocSortKey === 'team') {
                        const cmp = (a.team_name || '').localeCompare(b.team_name || '');
                        return assocSortOrder === 'desc' ? cmp : -cmp;
                      }
                      if (assocSortKey === 'role') {
                        const cmp = (a.role_title || '').localeCompare(b.role_title || '');
                        return assocSortOrder === 'desc' ? cmp : -cmp;
                      }
                      const da = a.submission_date ? new Date(a.submission_date).getTime() : 0;
                      const db = b.submission_date ? new Date(b.submission_date).getTime() : 0;
                      return assocSortOrder === 'desc' ? db - da : da - db;
                    });
                    const chipClass = (a: Association) => {
                      if (a.is_discarded) return 'bg-red-50 text-red-700 border-red-200';
                      const s = a.status || '';
                      if (s === 'client_submitted') return 'bg-blue-50 text-blue-700 border-blue-200';
                      if (s === 'client_rejected') return 'bg-gray-50 text-gray-700 border-gray-200';
                      if (s === 'deal') return 'bg-green-50 text-green-700 border-green-200';
                      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
                    };
                    const chipLabel = (a: Association) => {
                      if (a.is_discarded) return 'Discarded';
                      const s = a.status || 'submitted';
                      if (s === 'rm_evaluation') return 'Pending Evaluation';
                      if (s === 'submitted') return 'Submitted to AM';
                      if (s === 'client_submitted') return 'Submitted to Client';
                      if (s === 'client_rejected') return 'Client Rejected';
                      if (s === 'deal') return 'Deal';
                      return 'In Play';
                    };
                    return sorted.map((assoc) => (
                      <div
                        key={assoc.id}
                        className={`border-2 rounded-lg p-4 ${
                          assoc.is_discarded
                            ? 'border-red-200 bg-red-50'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Briefcase className={`w-4 h-4 ${assoc.is_discarded ? 'text-red-600' : 'text-indigo-600'}`} />
                              <h5 className="font-semibold text-slate-800">{assoc.role_title}</h5>
                            </div>
                            <p className="text-sm text-slate-600 font-mono mb-2">{assoc.role_code}</p>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-slate-500">Client:</span>
                                <p className="font-medium text-slate-800">{assoc.client_name}</p>
                              </div>
                              <div>
                                <span className="text-slate-500">Team:</span>
                                <p className="font-medium text-slate-800">{assoc.team_name}</p>
                              </div>
                              <div>
                                <span className="text-slate-500">Role Status:</span>
                                <p className="font-medium text-slate-800">
                                  {(() => {
                                    const rs = assoc.role_status || '';
                                    if (rs === 'active') return 'Active';
                                    if (rs === 'lost') return 'Lost';
                                    if (rs === 'deal') return 'Deal';
                                    if (rs === 'on_hold') return 'On Hold';
                                    if (rs === 'cancelled') return 'Cancelled';
                                    if (rs === 'no_answer') return 'No Answer';
                                    return rs || '-';
                                  })()}
                                </p>
                              </div>
                              <div>
                                <span className="text-slate-500">Submitted:</span>
                                <p className="font-medium text-slate-800">
                                  {new Date(assoc.submission_date).toLocaleDateString()}
                                </p>
                              </div>
                              <div>
                                <span className="text-slate-500">Submitted by:</span>
                                <p className="font-medium text-slate-800">
                                  {assoc.recruiter_name} ({assoc.recruiter_code})
                                </p>
                              </div>
                              <div>
                                <span className="text-slate-500">Association Status:</span>
                                <p className="font-medium text-slate-800">
                                  {(() => {
                                    const s = assoc.status || 'submitted';
                                    if (assoc.is_discarded) return 'Discarded';
                                    if (s === 'rm_evaluation') return 'Pending Evaluation';
                                    if (s === 'submitted') return 'Submitted to AM';
                                    if (s === 'client_submitted') return 'Submitted to Client';
                                    if (s === 'client_rejected') return 'Client Rejected';
                                    if (s === 'deal') return 'Deal';
                                    return 'In Play';
                                  })()}
                                </p>
                              </div>
                            </div>
                            {assoc.is_discarded && (
                              <div className="mt-3 pt-3 border-t border-red-200">
                                <p className="text-sm text-red-700">
                                  <strong>Discarded:</strong> {new Date(assoc.discarded_at).toLocaleDateString()}
                                </p>
                                {assoc.discarded_reason && (
                                  <p className="text-sm text-red-600 mt-1">
                                    Reason: {assoc.discarded_reason}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${chipClass(assoc)}`} title={chipLabel(assoc)}>
                              {chipLabel(assoc)}
                            </span>
                            {assoc.is_discarded !== 1 && (
                              <button
                                onClick={() => handleDiscardAssociation(candidateDetails.candidate.id, assoc.role_id)}
                                className="px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2 text-xs font-medium"
                                title="Discard from this role"
                              >
                                <Trash2 className="w-3 h-3" />
                                Discard
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
      )}
      {showDiscardModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white w-full max-w-md rounded-xl shadow-lg border border-slate-200 p-6">
            <div className="mb-4">
              <h3 className="text-xl font-semibold text-slate-800">Discard Reason</h3>
              <p className="text-sm text-slate-600 mt-1">Provide a reason for discarding (optional)</p>
            </div>
            <div>
              <input
                type="text"
                value={discardReason}
                onChange={(e) => setDiscardReason(e.target.value)}
                placeholder="Reason"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={cancelDiscard}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDiscard}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Confirm Discard
              </button>
            </div>
          </div>
        </div>
      )}
      {isAssocExportOpen && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white w-full max-w-3xl rounded-xl shadow-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-slate-800">Export Associations</h3>
              <button
                onClick={() => setIsAssocExportOpen(false)}
                className="p-2 rounded-md hover:bg-slate-100"
                title="Close"
              >
                <XCircle className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-72 overflow-auto">
              {assocAllExportFields.map((f) => (
                <label key={f} className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={assocExportFields.includes(f)}
                    onChange={() => toggleAssocField(f)}
                  />
                  <span className="text-sm text-slate-700">{assocFieldLabels[f] || f}</span>
                </label>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={selectAllAssocFields}
                className="px-3 py-2 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                Select All
              </button>
              <button
                onClick={clearAllAssocFields}
                className="px-3 py-2 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                Clear
              </button>
            </div>
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={assocPresetName}
                  onChange={(e) => setAssocPresetName(e.target.value)}
                  placeholder="Preset name"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                <button
                  onClick={saveAssocPreset}
                  className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                >
                  Save Preset
                </button>
              </div>
              {assocExportPresets.length > 0 && (
                <div className="flex items-center gap-2">
                  <select
                    onChange={(e) => applyAssocPresetByName(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    defaultValue=""
                  >
                    <option value="">Apply Preset</option>
                    {assocExportPresets.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      const name = assocPresetName.trim();
                      if (name) deleteAssocPresetByName(name);
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
                onClick={() => setIsAssocExportOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={exportAssocSelectedCsv}
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

      {/* Edit Candidate Modal */}
      {editingCandidate && (
        <EditCandidateModal
          candidate={editingCandidate}
          onClose={() => setEditingCandidate(null)}
          onSuccess={() => {
            setEditingCandidate(null);
            fetchCandidates();
            if (selectedCandidate) {
              fetchCandidateDetails(selectedCandidate.id);
            }
          }}
        />
      )}
    </div>
  );
}
