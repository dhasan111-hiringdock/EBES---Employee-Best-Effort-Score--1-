import { useState, useEffect } from "react";
import { FileText, Search, Filter, Download } from "lucide-react";
import { fetchWithAuth } from "@/react-app/utils/api";
 

export default function RMLedger() {
  const [viewMode, setViewMode] = useState<'roles' | 'candidates'>('roles');
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'custom'>('month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [eventType, setEventType] = useState<'all' | 'rm_evaluation' | 'submitted' | 'client_submitted' | 'client_rejected' | 'interview' | 'deal' | 'discarded' | 'dropout'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_play' | 'positive' | 'negative'>('all');
  const [roleStatusFilter, setRoleStatusFilter] = useState<'all' | 'active' | 'lost' | 'deal' | 'on_hold' | 'cancelled' | 'no_answer'>('all');
  const [loading, setLoading] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel' | 'pdf'>('csv');
  const [tableLoading, setTableLoading] = useState(false);
  const [roles, setRoles] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
 
  const [showCandidateModal, setShowCandidateModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<null | {
    event_date: string;
    event_type: string;
    candidate_name: string;
    candidate_code?: string;
    candidate_email?: string;
    candidate_phone?: string;
    role_title: string;
    role_code?: string;
    role_status?: string;
    role_description?: string;
    client_name: string;
    team_name: string;
    submission_type?: string;
    interview_level?: string;
    cv_match_percent?: string;
    notes?: string;
  }>(null);

  const exportLedger = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('date_range', dateRange);
      if (dateRange === 'custom' && startDate && endDate) {
        params.append('start_date', startDate);
        params.append('end_date', endDate);
      }
      if (eventType !== 'all') params.append('event_type', eventType);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (roleStatusFilter !== 'all') params.append('role_status', roleStatusFilter);
      if (search.trim()) params.append('search', search.trim());
      params.append('format', exportFormat);
      const res = await fetchWithAuth(`/api/rm/ledger/export?${params.toString()}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (exportFormat === 'pdf') {
          const w = window.open(url);
          if (!w) {
            const a = document.createElement('a');
            a.href = url;
            a.download = `rm-submissions-ledger.html`;
            a.click();
          }
        } else {
          const a = document.createElement('a');
          a.href = url;
          a.download = exportFormat === 'excel' ? `rm-submissions-ledger.xls` : `rm-submissions-ledger.csv`;
          a.click();
        }
        URL.revokeObjectURL(url);
      }
    } finally {
      setLoading(false);
    }
  };

 

  const fetchRolesView = async () => {
    setTableLoading(true);
    const res = await fetchWithAuth(`/api/rm/roles`);
    if (res.ok) {
      const data = await res.json();
      setRoles(data || []);
    } else {
      setRoles([]);
    }
    setTableLoading(false);
  };

  const fetchCandidatesView = async () => {
    setTableLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.append('search', search.trim());
    const res = await fetchWithAuth(`/api/rm/candidates?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setCandidates(data || []);
    } else {
      setCandidates([]);
    }
    setTableLoading(false);
  };

  useEffect(() => {
    if (viewMode === 'roles') {
      fetchRolesView();
    } else {
      fetchCandidatesView();
    }
  }, [viewMode]);
  useEffect(() => {
    if (viewMode === 'candidates') {
      fetchCandidatesView();
    }
  }, [search]);
 
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-600" />
          <h2 className="text-3xl font-bold text-slate-800">Submissions Ledger</h2>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as any)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            title="Export Format"
          >
            <option value="csv">CSV</option>
            <option value="excel">Excel</option>
            <option value="pdf">PDF</option>
          </select>
          <select
            value={roleStatusFilter}
            onChange={(e) => setRoleStatusFilter(e.target.value as any)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            title="Role Status"
          >
            <option value="all">Role Status: All</option>
            <option value="active">Active</option>
            <option value="lost">Lost</option>
            <option value="deal">Deal</option>
            <option value="on_hold">On Hold</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_answer">No Answer</option>
          </select>
          <button
            onClick={exportLedger}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            disabled={loading}
            title="Export"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as any)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            title="View By"
          >
            <option value="roles">View: Roles</option>
            <option value="candidates">View: Candidates</option>
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by candidate, role, client..."
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          {viewMode === 'roles' || viewMode === 'candidates' ? null : (
            <>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value as any)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                title="Event Type"
              >
                <option value="all">Event: All</option>
                <option value="rm_evaluation">Pending Evaluation</option>
                <option value="submitted">Submitted to AM</option>
                <option value="client_submitted">Submitted to Client</option>
                <option value="client_rejected">Client Rejected</option>
                <option value="interview">Interview</option>
                <option value="deal">Deal</option>
                <option value="discarded">Discarded</option>
                <option value="dropout">Dropout</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                title="Status"
              >
                <option value="all">Status: All</option>
                <option value="in_play">In Play</option>
                <option value="positive">Positive</option>
                <option value="negative">Negative</option>
              </select>
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as any)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  title="Date Range"
                >
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="custom">Custom</option>
                </select>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  disabled={dateRange !== 'custom'}
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  disabled={dateRange !== 'custom'}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {viewMode === 'roles' ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700">
              <Filter className="w-4 h-4" />
              <span className="text-sm">All roles</span>
            </div>
          </div>
          <div className="p-4">
            {tableLoading ? (
              <div className="py-8 text-center text-slate-600">Loading...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="px-3 py-2 border-b">Role</th>
                      <th className="px-3 py-2 border-b">Status</th>
                      <th className="px-3 py-2 border-b">Client</th>
                      <th className="px-3 py-2 border-b">Team</th>
                      <th className="px-3 py-2 border-b">Pending</th>
                      <th className="px-3 py-2 border-b">Submissions</th>
                      <th className="px-3 py-2 border-b">Under Evaluation</th>
                      <th className="px-3 py-2 border-b">Under Client Eval</th>
                      <th className="px-3 py-2 border-b">Client Rejected</th>
                      <th className="px-3 py-2 border-b">In Play</th>
                      <th className="px-3 py-2 border-b">Total Interviews</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roles
                      .filter((r) => {
                        const q = search.trim().toLowerCase();
                        if (!q) return true;
                        const s = `${r.title || ''} ${r.role_code || ''} ${r.client_name || ''} ${r.team_name || ''}`.toLowerCase();
                        return s.includes(q);
                      })
                      .map((r, i) => (
                        <tr key={i} className="border-b">
                          <td className="px-3 py-2">{`${r.title || ''}${r.role_code ? ` (${r.role_code})` : ''}`}</td>
                          <td className="px-3 py-2">{r.status || ''}</td>
                          <td className="px-3 py-2">{r.client_name || ''}</td>
                          <td className="px-3 py-2">{r.team_name || ''}</td>
                          <td className="px-3 py-2">{r.pending_submissions ?? 0}</td>
                          <td className="px-3 py-2">{r.total_submissions ?? 0}</td>
                          <td className="px-3 py-2">{r.under_evaluation ?? 0}</td>
                          <td className="px-3 py-2">{r.under_client_evaluation ?? 0}</td>
                          <td className="px-3 py-2">{r.client_rejected ?? 0}</td>
                          <td className="px-3 py-2">{r.in_play_submissions ?? 0}</td>
                          <td className="px-3 py-2">{r.total_interviews ?? 0}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700">
              <Filter className="w-4 h-4" />
              <span className="text-sm">All candidates</span>
            </div>
          </div>
          <div className="p-4">
            {tableLoading ? (
              <div className="py-8 text-center text-slate-600">Loading...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="px-3 py-2 border-b">Candidate</th>
                      <th className="px-3 py-2 border-b">Email</th>
                      <th className="px-3 py-2 border-b">Phone</th>
                      <th className="px-3 py-2 border-b">Total Roles</th>
                      <th className="px-3 py-2 border-b">In Play</th>
                      <th className="px-3 py-2 border-b">RM Evaluation</th>
                      <th className="px-3 py-2 border-b">Submitted</th>
                      <th className="px-3 py-2 border-b">Client Submitted</th>
                      <th className="px-3 py-2 border-b">Client Rejected</th>
                      <th className="px-3 py-2 border-b">Deals</th>
                      <th className="px-3 py-2 border-b">Last Activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((c, i) => (
                      <tr key={i} className="border-b">
                        <td className="px-3 py-2">{`${c.candidate_name || ''}${c.candidate_code ? ` (${c.candidate_code})` : ''}`}</td>
                        <td className="px-3 py-2">{c.email || ''}</td>
                        <td className="px-3 py-2">{c.phone || ''}</td>
                        <td className="px-3 py-2">{c.total_roles ?? 0}</td>
                        <td className="px-3 py-2">{c.in_play_roles ?? 0}</td>
                        <td className="px-3 py-2">{c.rm_evaluation ?? 0}</td>
                        <td className="px-3 py-2">{c.submitted ?? 0}</td>
                        <td className="px-3 py-2">{c.client_submitted ?? 0}</td>
                        <td className="px-3 py-2">{c.client_rejected ?? 0}</td>
                        <td className="px-3 py-2">{c.deals ?? 0}</td>
                        <td className="px-3 py-2">{c.last_event_date || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      {showCandidateModal && selectedEntry && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">Candidate Details</h3>
              <button
                className="px-2 py-1 rounded border border-slate-300"
                onClick={() => {
                  setShowCandidateModal(false);
                  setSelectedEntry(null);
                }}
              >
                Close
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-slate-500 text-sm">Name</div>
                  <div className="text-slate-800 font-medium">{selectedEntry.candidate_name || ''}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-sm">Code</div>
                  <div className="text-slate-800 font-medium">{selectedEntry.candidate_code || 'Not provided'}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-sm">Email</div>
                  <div className="text-slate-800 font-medium">{selectedEntry.candidate_email || 'Not provided'}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-sm">Phone</div>
                  <div className="text-slate-800 font-medium">{selectedEntry.candidate_phone || 'Not provided'}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-slate-500 text-sm">Role</div>
                  <div className="text-slate-800 font-medium">{`${selectedEntry.role_title}${selectedEntry.role_code ? ` (${selectedEntry.role_code})` : ''}`}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-sm">Client / Team</div>
                  <div className="text-slate-800 font-medium">{`${selectedEntry.client_name} / ${selectedEntry.team_name}`}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-sm">Role Status</div>
                  <div className="text-slate-800 font-medium">{selectedEntry.role_status || 'Not provided'}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-sm">Role Description</div>
                  <div className="text-slate-800">{selectedEntry.role_description || 'Not provided'}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-slate-500 text-sm">Event</div>
                  <div className="text-slate-800 font-medium">{selectedEntry.event_type}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-sm">Date</div>
                  <div className="text-slate-800 font-medium">{selectedEntry.event_date}</div>
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-sm">Notes</div>
                <div className="text-slate-800">{selectedEntry.notes || ''}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
