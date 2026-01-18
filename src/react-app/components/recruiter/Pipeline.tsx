import { useEffect, useMemo, useState } from "react";
import { BarChart3, AlertTriangle, Download } from "lucide-react";
import { fetchWithAuth, recruiterDiscardCandidateFromRole, getRecruiterRoleSubmissions, recruiterMarkDeal, recruiterSeedSampleData } from "@/react-app/utils/api";
 
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

interface PipelineData {
  counts: {
    submissions: number;
    interview_1: number;
    interview_2: number;
    interview_3: number;
    deals: number;
    dropouts: number;
  };
  sla: {
    roles_no_submission_7d: number;
    roles_no_interview_7d: number;
  };
  focus: Array<{ role_id: number; role_code: string; title: string; reason: string }>;
}
 
export default function RecruiterPipeline() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [pipeline, setPipeline] = useState<PipelineData | null>(null);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleStatus, setRoleStatus] = useState<"active" | "non-active">("active");
  const [search, setSearch] = useState("");
  const [dataByRole, setDataByRole] = useState<Record<number, { under_consideration: RoleSubmission[]; rejected: RoleSubmission[] }>>({});
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortKey, setSortKey] = useState<"recent" | "score" | "location" | "contract" | "payment">("recent");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [candidateStatusFilter, setCandidateStatusFilter] = useState<string>("all");
  const [roleStatusFilter, setRoleStatusFilter] = useState<"all" | "active" | "lost" | "deal" | "on_hold" | "cancelled" | "no_answer">("all");
  const [noteDialog, setNoteDialog] = useState<{ roleId: number; candidateId: number } | null>(null);
  const [noteText, setNoteText] = useState<string>("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<number>(0);
  const quickReasons = useMemo(() => ["Not a fit", "Lack of required skills", "Better candidate found", "Recruiter error", "Client request"], []);
  const [pipeModal, setPipeModal] = useState<{ roleId: number; roleCode: string; title: string; status: string } | null>(null);
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
 
  useEffect(() => {
    const loadClients = async () => {
      try {
        const res = await fetchWithAuth("/api/recruiter/clients");
        if (res.ok) {
          const data = await res.json();
          setClients(data || []);
          if ((data || []).length > 0) {
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
          if ((data || []).length > 0) {
            setSelectedTeamId((data[0] as any).id);
          }
        }
      } catch {}
    };
    loadTeams();
  }, []);
 
  useEffect(() => {
    const loadPipeline = async () => {
      setLoading(true);
      try {
        const q = selectedClientId ? `?client_id=${selectedClientId}` : "";
        const res = await fetchWithAuth(`/api/recruiter/pipeline${q}`);
        if (res.ok) {
          const data = await res.json();
          setPipeline(data || null);
        } else {
          setPipeline(null);
        }
      } catch {
        setPipeline(null);
      } finally {
        setLoading(false);
      }
    };
    loadPipeline();
  }, [selectedClientId, refreshToken]);
 
  useEffect(() => {
    const loadRoles = async () => {
      if (!selectedClientId && !selectedTeamId) {
        setRoles([]);
        return;
      }
      setRolesLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedClientId != null) params.set("client_id", String(selectedClientId));
        if (selectedTeamId != null) params.set("team_id", String(selectedTeamId));
        params.set("is_active", roleStatus === "active" ? "1" : "0");
        if (search.trim().length > 0) params.set("search", search.trim());
        const res = await fetchWithAuth(`/api/recruiter/roles-list?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setRoles(data || []);
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
  }, [selectedClientId, selectedTeamId, roleStatus, search, refreshToken]);

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
 
  const populateSampleData = async () => {
    try {
      const res = await recruiterSeedSampleData(6, selectedClientId ?? undefined, selectedTeamId ?? undefined);
      if (res.ok) {
        setRefreshToken((x) => x + 1);
      }
    } catch {}
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

  const totalInterviews =
    (pipeline?.counts.interview_1 || 0) +
    (pipeline?.counts.interview_2 || 0) +
    (pipeline?.counts.interview_3 || 0);
 
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Pipe</h2>
          <p className="text-slate-500 mt-1">Live counts, roles, and focus</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search roles..."
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            title="Search roles"
          />
          <select
            value={roleStatus}
            onChange={(e) => setRoleStatus(e.target.value as any)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            title="Filter by Role Status"
          >
            <option value="active">Active Roles</option>
            <option value="non-active">Non-Active Roles</option>
          </select>
          <select
            value={selectedClientId ?? ""}
            onChange={(e) => setSelectedClientId(e.target.value ? Number(e.target.value) : null)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            title="Client"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.team_name ? `• ${c.team_name}` : ""}
              </option>
            ))}
            {!clients.length && <option value="">No clients</option>}
          </select>
          <select
            value={selectedTeamId ?? ""}
            onChange={(e) => setSelectedTeamId(e.target.value ? Number(e.target.value) : null)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            title="Team"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            {!teams.length && <option value="">No teams</option>}
          </select>
          <button
            onClick={populateSampleData}
            className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg"
            title="Populate Sample Data"
          >
            Populate Sample Data
          </button>
        </div>
      </div>
 
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : !pipeline ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <p className="text-slate-600">No pipeline data available.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-xs text-blue-600">
                <BarChart3 className="w-4 h-4" />
                Submissions
              </div>
              <div className="text-2xl font-bold text-blue-900">{pipeline.counts.submissions}</div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-xs text-purple-600">
                <BarChart3 className="w-4 h-4" />
                Interviews
              </div>
              <div className="text-2xl font-bold text-purple-900">{totalInterviews}</div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-xs text-emerald-600">
                <BarChart3 className="w-4 h-4" />
                Deals
              </div>
              <div className="text-2xl font-bold text-emerald-700">{pipeline.counts.deals}</div>
            </div>
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-xs text-rose-600">
                <BarChart3 className="w-4 h-4" />
                Dropouts
              </div>
              <div className="text-2xl font-bold text-rose-700">{pipeline.counts.dropouts}</div>
            </div>
          </div>
 
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-xs text-amber-700">
                <AlertTriangle className="w-4 h-4" /> No submission ≥7d
              </div>
              <div className="text-xl font-bold text-amber-800">{pipeline.sla.roles_no_submission_7d}</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-xs text-red-700">
                <AlertTriangle className="w-4 h-4" /> No interview ≥7d
              </div>
              <div className="text-xl font-bold text-red-800">{pipeline.sla.roles_no_interview_7d}</div>
            </div>
          </div>
 
          {pipeline.focus.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <BarChart3 className="w-6 h-6 text-indigo-600" />
                <h3 className="text-xl font-bold text-slate-800">Focus</h3>
              </div>
              <div className="space-y-2">
                {pipeline.focus.slice(0, 10).map((f, i) => (
                  <div key={`${f.role_id}-${i}`} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-semibold text-slate-800">{f.title}</div>
                      <div className="text-xs text-slate-500 font-mono">{f.role_code}</div>
                    </div>
                    <div className="text-xs font-semibold px-2 py-1 rounded-full border">{f.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

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
                        <div className="text-xs text-slate-500">Status: {role.status}</div>
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
                        onClick={() => {
                          setPipeModal({ roleId: role.id, roleCode: role.role_code, title: role.title, status: role.status });
                          if (!dataByRole[role.id]) {
                            loadRoleCandidates(role.id);
                          }
                        }}
                        className="px-3 py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-50"
                        title="Open Pipe"
                      >
                        Open Pipe
                      </button>
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
                  {/* Inline expand section removed; Pipe modal covers candidate details */}
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
      {pipeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-4xl">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{pipeModal.title}</h3>
                <p className="text-xs text-gray-600 font-mono">{pipeModal.roleCode}</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={roleStatusFilter}
                  onChange={(e) => setRoleStatusFilter(e.target.value as any)}
                  className="px-2 py-1 text-xs border border-gray-300 rounded"
                  title="Role Status"
                >
                  <option value="all">Role: All</option>
                  <option value="active">Active</option>
                  <option value="lost">Lost</option>
                  <option value="deal">Deal</option>
                  <option value="on_hold">On Hold</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="no_answer">No Answer</option>
                </select>
                <button
                  onClick={() => {
                    const roleId = pipeModal.roleId;
                    const roleCode = pipeModal.roleCode;
                    const bucket = dataByRole[roleId] || { under_consideration: [], rejected: [] };
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
                            roleCode,
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
                    a.download = `${roleCode}-pipeline.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-1 text-sm px-3 py-1 rounded border border-gray-200 text-gray-700 hover:bg-gray-50"
                  title="Export CSV"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
                <button
                  className="px-3 py-1 text-sm border border-gray-300 rounded"
                  onClick={() => setPipeModal(null)}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="p-4">
              {roleStatusFilter !== "all" && (pipeModal.status || "").toLowerCase() !== roleStatusFilter ? (
                <div className="text-sm text-gray-600">
                  Role status is {pipeModal.status}. Change filter to view candidates.
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-center gap-3">
                    <input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search candidates"
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <select
                      value={candidateStatusFilter}
                      onChange={(e) => setCandidateStatusFilter(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      title="Filter by Candidate Status"
                    >
                      <option value="all">Filter: All</option>
                      <option value="rm_evaluation">Pending Evaluation</option>
                      <option value="client_submitted">Submitted to Client</option>
                      <option value="client_rejected">Client Rejected</option>
                      <option value="deal">Deal</option>
                      <option value="discarded">Discarded</option>
                    </select>
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
                  </div>
                  <div className="overflow-x-auto max-h-[420px] overflow-y-auto relative">
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
                          const roleId = pipeModal.roleId;
                          const bucket = dataByRole[roleId] || { under_consideration: [], rejected: [] };
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
                                  onClick={() => setOpenMenuFor(`${pipeModal.roleId}:${row.candidate_id}`)}
                                >
                                  {statusChipLabel(row)}
                                </button>
                                {openMenuFor === `${pipeModal.roleId}:${row.candidate_id}` && (
                                  <div className="absolute z-10 mt-2 bg-white border border-gray-200 rounded shadow-lg p-2 w-48">
                                    {row.has_interview === 1 && (
                                      <button
                                        className="w-full text-left px-2 py-1 text-sm hover:bg-gray-50 rounded"
                                        onClick={() => {
                                          setOpenMenuFor(null);
                                          markDeal(pipeModal.roleId, row.candidate_id!);
                                        }}
                                      >
                                        Deal
                                      </button>
                                    )}
                                    <button
                                      className="w-full text-left px-2 py-1 text-sm hover:bg-gray-50 rounded text-red-600"
                                      onClick={() => {
                                        setOpenMenuFor(null);
                                        setNoteDialog({ roleId: pipeModal.roleId, candidateId: row.candidate_id! });
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
                                        onClick={() => markDeal(pipeModal.roleId, row.candidate_id!)}
                                        className="text-xs px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                                      >
                                        Mark Deal
                                      </button>
                                    )}
                                    <button
                                      className="text-xs px-3 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50"
                                      onClick={() => setNoteDialog({ roleId: pipeModal.roleId, candidateId: row.candidate_id! })}
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
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
