import { useEffect, useMemo, useState } from "react";
import { CheckCircle, XCircle, Download, BarChart3 } from "lucide-react";
import { fetchWithAuth, recruiterDiscardCandidateFromRole, getRecruiterRoleSubmissions, recruiterMarkDeal } from "@/react-app/utils/api";
import { useLocation } from "react-router";
 
interface Client {
  id: number;
  name: string;
  client_code: string;
  team_id?: number;
  team_name?: string;
}
interface Team {
  id: number;
  name: string;
  team_code: string;
}
 
interface Role {
  id: number;
  role_code: string;
  title: string;
  status: string;
  client_name?: string;
  team_name?: string;
  total_submissions?: number;
  total_interviews?: number;
  total_deals?: number;
  client_submitted?: number;
  client_rejected?: number;
  active_candidates?: number;
  discarded_candidates?: number;
  in_play_submissions?: number;
}

interface RoleSubmission {
  association_id: number;
  candidate_id: number;
  candidate_name: string;
  candidate_email?: string;
  candidate_phone?: string;
  submission_date?: string;
  is_discarded?: number;
  discarded_at?: string;
  discarded_reason?: string;
  recruiter_name?: string;
  recruiter_code?: string;
  submission_id?: number;
  score?: number;
  rm_validation_status?: string;
  rm_rate_bill?: number;
  rm_rate_pay?: number;
  rm_location?: string;
  rm_work_type?: string;
  association_status?: string;
  has_interview?: number;
}

 
 
export default function RecruiterPipeline() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const location = useLocation();
  const [rolesLoading, setRolesLoading] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>("active");
  const [dataByRole, setDataByRole] = useState<Record<number, { under_consideration: RoleSubmission[]; rejected: RoleSubmission[] }>>({});
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortKey, setSortKey] = useState<"recent" | "score" | "location" | "contract" | "payment">("recent");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [candidateStatusFilter, setCandidateStatusFilter] = useState<string>("all");
  const [noteDialog, setNoteDialog] = useState<{ roleId: number; candidateId: number } | null>(null);
  const [noteText, setNoteText] = useState<string>("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const quickReasons = useMemo(() => ["Not a fit", "Lack of required skills", "Better candidate found", "Recruiter error", "Client request"], []);
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-700 border-green-200",
    deal: "bg-blue-100 text-blue-700 border-blue-200",
    lost: "bg-red-100 text-red-700 border-red-200",
    on_hold: "bg-yellow-100 text-yellow-700 border-yellow-200",
    cancelled: "bg-gray-100 text-gray-700 border-gray-200",
    no_answer: "bg-orange-100 text-orange-700 border-orange-200",
  };
  const statusLabels: Record<string, string> = {
    active: "Active",
    deal: "Deal",
    lost: "Lost",
    on_hold: "On Hold",
    cancelled: "Cancelled",
    no_answer: "No Answer",
  };
  
 
  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    const cId = params.get("client_id");
    const tId = params.get("team_id");
    if (cId) setSelectedClientId(Number(cId));
    if (tId) setSelectedTeamId(Number(tId));
    const loadClients = async () => {
      try {
        const res = await fetchWithAuth("/api/recruiter/clients");
        if (res.ok) {
          const data = await res.json();
          setClients(data || []);
          if ((data || []).length > 0 && selectedClientId == null) {
            setSelectedClientId((data[0] as any).id);
          }
        }
      } catch {}
    };
    loadClients();
  }, []);

  useEffect(() => {
    const loadTeams = async () => {
      try {
        const res = await fetchWithAuth("/api/recruiter/teams");
        if (res.ok) {
          const data = await res.json();
          setTeams(data || []);
          if ((data || []).length > 0 && selectedTeamId == null) {
            setSelectedTeamId((data[0] as any).id);
          }
        }
      } catch {}
    };
    loadTeams();
  }, []);
 
  
 
  useEffect(() => {
    const loadRoles = async () => {
      setRolesLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedClientId != null) params.set("client_id", String(selectedClientId));
        if (selectedTeamId != null) params.set("team_id", String(selectedTeamId));
        params.set("status", selectedStatus);
        const res = await fetchWithAuth(`/api/recruiter/roles-list?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          console.log("RecruiterPipeline roles payload", Array.isArray(data) ? data.length : null, Array.isArray(data) ? data.slice(0, 1) : data);
          setRoles(data || []);
          const results = await Promise.all(
            (data || []).map(async (role: Role) => {
              const r = await getRecruiterRoleSubmissions(role.id);
              if (!r.ok) return { roleId: role.id, under_consideration: [], rejected: [] };
              const payload = await r.json();
              return { roleId: role.id, under_consideration: payload.under_consideration || [], rejected: payload.rejected || [] };
            })
          );
          const map: Record<number, { under_consideration: RoleSubmission[]; rejected: RoleSubmission[] }> = {};
          for (const item of results) {
            map[(item as any).roleId] = { under_consideration: (item as any).under_consideration, rejected: (item as any).rejected };
          }
          setDataByRole(map);
        } else {
          setRoles([]);
        }
      } catch {
        setRoles([]);
      } finally {
        setRolesLoading(false);
      }
    };
    loadRoles();
  }, [selectedClientId, selectedTeamId, selectedStatus]);

  const loadRoleCandidates = async (roleId: number) => {
    try {
      const res = await getRecruiterRoleSubmissions(roleId);
      if (res.ok) {
        const payload = await res.json();
        const under = (payload?.under_consideration || []) as RoleSubmission[];
        const rej = (payload?.rejected || []) as RoleSubmission[];
        setDataByRole((prev) => ({ ...prev, [roleId]: { under_consideration: under, rejected: rej } }));
      }
    } catch {}
  };

  const exportRoleRows = (role: Role) => {
    const bucket = dataByRole[role.id] || { under_consideration: [], rejected: [] };
    const rows = [...(bucket.under_consideration || []), ...(bucket.rejected || [])];
    const headers = [
      "role_code",
      "candidate_name",
      "recruiter_name",
      "recruiter_code",
      "rm_location",
      "rm_work_type",
      "rm_rate_bill",
      "score",
      "submission_date",
      "rm_validation_status",
      "association_status",
      "is_discarded"
    ];
    const csv = [headers.join(",")]
      .concat(
        rows.map((r) =>
          [
            role.role_code,
            (r.candidate_name || "").replace(/,/g, " "),
            (r.recruiter_name || "").replace(/,/g, " "),
            (r.recruiter_code || "").replace(/,/g, " "),
            (r.rm_location || "").replace(/,/g, " "),
            (r.rm_work_type || "").replace(/,/g, " "),
            r.rm_rate_bill != null ? String(Number(r.rm_rate_bill)) : "",
            r.score != null ? String(Number(r.score)) : "",
            r.submission_date || "",
            (r.rm_validation_status || "").replace(/,/g, " "),
            r.association_status || "",
            String(r.is_discarded || 0)
          ].join(",")
        )
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${role.role_code}-pipeline.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
 
  const discardCandidateFromRole = async (roleId: number, candidateId: number) => {
    if (!noteText.trim()) {
      setNoteError("Please provide a reason");
      return;
    }
    try {
      const res = await recruiterDiscardCandidateFromRole(roleId, candidateId, noteText.trim());
      if (res.ok) {
        await loadRoleCandidates(roleId);
        setNoteDialog(null);
        setNoteText("");
        setNoteError(null);
      } else {
        setNoteError("Failed to discard candidate");
      }
    } catch {
      setNoteError("Failed to discard candidate");
    }
  };
  
  const markDeal = async (roleId: number, candidateId: number) => {
    try {
      const res = await recruiterMarkDeal(roleId, candidateId);
      if (res.ok) {
        await loadRoleCandidates(roleId);
      }
    } catch {}
  };
  
  const formatPayment = (row: RoleSubmission) => {
    if (row.rm_rate_bill == null) return "-";
    const unit = (row.rm_work_type || "").toLowerCase() === "payroll" ? "annually" : (row.rm_work_type || "").toLowerCase() === "sow" ? "per day" : "";
    return `€${Number(row.rm_rate_bill)} ${unit}`;
  };
  
  const statusChipClass = (row: RoleSubmission) => {
    if (row.is_discarded === 1) return "bg-red-50 text-red-700 border-red-200";
    if (row.association_status === "client_submitted") return "bg-blue-50 text-blue-700 border-blue-200";
    if (row.association_status === "client_rejected") return "bg-gray-50 text-gray-700 border-gray-200";
    if (row.association_status === "deal") return "bg-green-50 text-green-700 border-green-200";
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  };
  
  const statusChipLabel = (row: RoleSubmission) => {
    if (row.is_discarded === 1) return "Discarded";
    if (row.association_status === "client_submitted") return "Submitted to Client";
    if (row.association_status === "client_rejected") return "Client Rejected";
    if (row.association_status === "deal") return "Deal";
    return "Submitted to AM";
  };

  
 
  const totals = useMemo(() => {
    let submittedToClient = 0;
    let discarded = 0;
    let clientRejected = 0;
    for (const roleId of Object.keys(dataByRole)) {
      const under = dataByRole[Number(roleId)].under_consideration || [];
      const rej = dataByRole[Number(roleId)].rejected || [];
      submittedToClient += under.filter((r) => r.association_status === 'client_submitted' && r.is_discarded !== 1).length;
      clientRejected += under.filter((r) => r.association_status === 'client_rejected' && r.is_discarded !== 1).length;
      clientRejected += rej.filter((r) => r.association_status === 'client_rejected' && r.is_discarded !== 1).length;
      discarded += rej.filter((r) => r.is_discarded === 1).length;
    }
    return { submittedToClient, clientRejected, discarded };
  }, [dataByRole]);
  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    const assoc = params.get('association_id');
    if (!assoc) return;
    const el = document.getElementById(`assoc-${assoc}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [location.search, dataByRole, roles]);
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-3xl font-bold text-gray-900">Pipeline</h2>
          <div className="mt-3 flex items-center gap-3">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search candidates"
              className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="recent">Sort: Recent</option>
              <option value="score">Sort: Score</option>
              <option value="location">Sort: Location</option>
              <option value="contract">Sort: Contract Type</option>
              <option value="payment">Sort: Payment</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="desc">Order: Desc</option>
              <option value="asc">Order: Asc</option>
            </select>
            <select
              value={candidateStatusFilter}
              onChange={(e) => setCandidateStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              title="Filter by Candidate Status"
            >
              <option value="all">Filter: All</option>
              <option value="rm_evaluation">Pending Evaluation</option>
              <option value="submitted">Submitted to AM</option>
              <option value="client_submitted">Submitted to Client</option>
              <option value="client_rejected">Client Rejected</option>
              <option value="deal">Deal</option>
              <option value="discarded">Discarded</option>
            </select>
          </div>
        </div>
        <div className="w-full md:w-64">
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Client</label>
          <select
            value={selectedClientId != null ? String(selectedClientId) : ""}
            onChange={(e) => setSelectedClientId(e.target.value ? Number(e.target.value) : null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-3"
          >
            <option value="">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Team</label>
          <select
            value={selectedTeamId != null ? String(selectedTeamId) : ""}
            onChange={(e) => setSelectedTeamId(e.target.value ? Number(e.target.value) : null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-3"
          >
            <option value="">All Teams</option>
            {teams.map((t) => (
              <option key={t.id} value={String(t.id)}>
                {t.name}
              </option>
            ))}
          </select>
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Role Status</label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="active">Active Roles</option>
            <option value="deal">Deal Roles</option>
            <option value="lost">Lost Roles</option>
            <option value="cancelled">Cancelled Roles</option>
            <option value="on_hold">On Hold Roles</option>
          </select>
        </div>
      </div>
 
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-green-600" />
          <div>
            <p className="text-sm text-green-700 font-semibold">Submitted to Client</p>
            <p className="text-2xl font-bold text-green-700">{totals.submittedToClient}</p>
          </div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center gap-3">
          <XCircle className="w-6 h-6 text-gray-700" />
          <div>
            <p className="text-sm text-gray-700 font-semibold">Client Rejected</p>
            <p className="text-2xl font-bold text-gray-900">{totals.clientRejected}</p>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <XCircle className="w-6 h-6 text-red-600" />
          <div>
            <p className="text-sm text-red-700 font-semibold">Rejected</p>
            <p className="text-2xl font-bold text-red-700">{totals.discarded}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-indigo-600" />
          <h3 className="text-xl font-bold text-slate-800">Roles</h3>
        </div>
        {rolesLoading ? (
          <div className="flex items-center justify-center h-24">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
          </div>
        ) : roles.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <p className="text-slate-600">No roles found for the selected filters.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {roles.map((role) => {
              return (
                <div key={role.id} className="bg-white rounded-2xl shadow-sm border border-slate-200">
                  <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="text-sm text-slate-500 font-mono">{role.role_code}</div>
                        <div className="text-lg font-bold text-slate-800">{role.title}</div>
                        <div className={`px-2 py-0.5 rounded-full border text-xs font-medium inline-block mt-1 ${statusColors[role.status] || "border-slate-200"}`}>
                          {statusLabels[role.status] || role.status}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-1">
                        In Pipe: {(dataByRole[role.id]?.under_consideration?.length ?? role.active_candidates ?? role.in_play_submissions ?? 0)}
                      </span>
                      <span className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-1">
                        Rejected: {(dataByRole[role.id]?.rejected?.length ?? role.client_rejected ?? role.discarded_candidates ?? 0)}
                      </span>
                      <button
                        onClick={() => exportRoleRows(role)}
                        className="px-3 py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-50 flex items-center gap-2"
                        title="Export CSV"
                      >
                        <Download className="w-4 h-4" />
                        Export
                      </button>
                    </div>
                  </div>
                  <div className="p-4 overflow-x-auto max-h-[420px] overflow-y-auto relative">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
                          <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700">Candidate</th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700">Location</th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700">Payment</th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700">Score (0–5)</th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700">Contract Type</th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700">Date Submitted</th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700">RM Status</th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700">Current Status</th>
                          <th className="text-right py-2 px-3 text-xs font-semibold text-gray-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const bucket = dataByRole[role.id] || { under_consideration: [], rejected: [] };
                          const rows = [...(bucket.under_consideration || []), ...(bucket.rejected || [])];
                          const term = searchTerm.trim().toLowerCase();
                          const filteredByStatus = rows.filter((row) => {
                            if (candidateStatusFilter === "all") return true;
                            if (candidateStatusFilter === "discarded") return row.is_discarded === 1;
                            return (row.association_status || "") === candidateStatusFilter && row.is_discarded !== 1;
                          });
                          const filtered = term
                            ? filteredByStatus.filter((row) => {
                                const c = (row.candidate_name || "").toLowerCase();
                                const rec = `${row.recruiter_name || ""} ${row.recruiter_code || ""}`.toLowerCase();
                                const loc = (row.rm_location || "").toLowerCase();
                                return c.includes(term) || rec.includes(term) || loc.includes(term);
                              })
                            : filteredByStatus;
                          const sorted = [...filtered].sort((a, b) => {
                            if (sortKey === "score") {
                              const sa = a.score != null ? Number(a.score) : -Infinity;
                              const sb = b.score != null ? Number(b.score) : -Infinity;
                              return sortOrder === "desc" ? sb - sa : sa - sb;
                            }
                            if (sortKey === "location") {
                              const cmp = (a.rm_location || "").localeCompare(b.rm_location || "");
                              return sortOrder === "desc" ? cmp : -cmp;
                            }
                            if (sortKey === "contract") {
                              const cmp = (a.rm_work_type || "").localeCompare(b.rm_work_type || "");
                              return sortOrder === "desc" ? cmp : -cmp;
                            }
                            if (sortKey === "payment") {
                              const pa = a.rm_rate_bill != null ? Number(a.rm_rate_bill) : -Infinity;
                              const pb = b.rm_rate_bill != null ? Number(b.rm_rate_bill) : -Infinity;
                              return sortOrder === "desc" ? pb - pa : pa - pb;
                            }
                            const da = a.submission_date ? new Date(a.submission_date).getTime() : 0;
                            const db = b.submission_date ? new Date(b.submission_date).getTime() : 0;
                            return sortOrder === "desc" ? db - da : da - db;
                          });
                          return sorted.map((row) => (
                            <tr id={`assoc-${row.association_id}`} key={row.association_id || `${row.candidate_id}-${row.submission_id || 0}`} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-2 px-3">
                                <div className="font-medium text-gray-900">{row.candidate_name || "Unknown"}</div>
                                <div className="text-xs text-gray-500">
                                  {row.recruiter_name} · {row.recruiter_code}
                                </div>
                              </td>
                              <td className="py-2 px-3 text-sm text-gray-700">{row.rm_location || "-"}</td>
                              <td className="py-2 px-3 text-sm text-gray-700" title={`Contract: ${row.rm_work_type || "-"} • Unit: ${((row.rm_work_type || '').toLowerCase() === 'payroll' ? 'annually' : (row.rm_work_type || '').toLowerCase() === 'sow' ? 'per day' : '') || '-'}`}>
                                {formatPayment(row)}
                              </td>
                              <td className="py-2 px-3 text-sm text-gray-700">{row.score != null ? Number(row.score).toFixed(2) : "-"}</td>
                              <td className="py-2 px-3 text-sm text-gray-700">{row.rm_work_type || "-"}</td>
                              <td className="py-2 px-3 text-sm text-gray-700">{row.submission_date?.slice(0, 10) || "-"}</td>
                              <td className="py-2 px-3 text-sm text-gray-700">{row.rm_validation_status || "-"}</td>
                              <td className="py-2 px-3 text-sm relative">
                                <button
                                  className={`px-2 py-1 rounded text-xs border ${statusChipClass(row)}`}
                                  title={statusChipLabel(row)}
                                  onClick={() => setOpenMenuFor(`${role.id}:${row.candidate_id}`)}
                                >
                                  {statusChipLabel(row)}
                                </button>
                                {openMenuFor === `${role.id}:${row.candidate_id}` && (
                                  <div className="absolute z-10 mt-2 bg-white border border-gray-200 rounded shadow-lg p-2 w-48">
                                    {row.has_interview === 1 && (
                                      <button
                                        className="w-full text-left px-2 py-1 text-sm hover:bg-gray-50 rounded"
                                        onClick={() => {
                                          setOpenMenuFor(null);
                                          markDeal(role.id, row.candidate_id!);
                                        }}
                                      >
                                        Deal
                                      </button>
                                    )}
                                    <button
                                      className="w-full text-left px-2 py-1 text-sm hover:bg-gray-50 rounded text-red-600"
                                      onClick={() => {
                                        setOpenMenuFor(null);
                                        setNoteDialog({ roleId: role.id, candidateId: row.candidate_id! });
                                      }}
                                    >
                                      Discard
                                    </button>
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right">
                                {row.is_discarded !== 1 ? (
                                  <div className="flex items-center justify-end gap-2">
                                    {row.association_status === 'client_submitted' && row.has_interview === 1 && (
                                      <button
                                        onClick={() => markDeal(role.id, row.candidate_id!)}
                                        className="text-xs px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                                      >
                                        Mark Deal
                                      </button>
                                    )}
                                    <button
                                      className="text-xs px-3 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50"
                                      onClick={() => setNoteDialog({ roleId: role.id, candidateId: row.candidate_id! })}
                                    >
                                      Discard
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">—</span>
                                )}
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
 
      {noteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-md p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Discard Candidate</h3>
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
              <button
                onClick={() => {
                  setNoteDialog(null);
                  setNoteText("");
                  setNoteError(null);
                }}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                disabled={!noteText.trim()}
                onClick={() => discardCandidateFromRole(noteDialog.roleId, noteDialog.candidateId)}
                className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
