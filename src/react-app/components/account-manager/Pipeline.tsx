import { useEffect, useMemo, useState } from "react";
import { CheckCircle, XCircle, Download } from "lucide-react";
import { fetchWithAuth } from "@/react-app/utils/api";

interface Role {
  id: number;
  role_code: string;
  title: string;
  status: string;
  total_submissions: number;
}

interface RoleSubmission {
  association_id: number;
  candidate_id: number;
  candidate_name: string;
  candidate_email?: string;
  candidate_phone?: string;
  submission_date: string;
  is_discarded: number;
  discarded_at?: string;
  discarded_reason?: string;
  recruiter_name: string;
  recruiter_code: string;
  submission_id?: number;
  score?: number;
  rm_validation_status?: string;
  rm_rate_bill?: number;
  rm_rate_pay?: number;
  rm_location?: string;
  rm_work_type?: string;
  am_notes?: string;
  am_reviewed_at?: string;
  association_status?: string;
}

interface PipelineProps {
  clientId: number;
  teamId: number;
}

export default function Pipeline({ clientId, teamId }: PipelineProps) {
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [dataByRole, setDataByRole] = useState<Record<number, { under_consideration: RoleSubmission[]; rejected: RoleSubmission[] }>>({});
  const [selectedStatus, setSelectedStatus] = useState<string>("active");
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortKey, setSortKey] = useState<"recent" | "score" | "location" | "contract" | "payment">("recent");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [candidateStatusFilter, setCandidateStatusFilter] = useState<string>("all");

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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          status: selectedStatus,
          client_id: String(clientId),
          team_id: String(teamId),
        });
        const res = await fetchWithAuth(`/api/am/roles?${params}`);
        if (!res.ok) return;
        const rolesData: Role[] = await res.json();
        setRoles(rolesData);

        const results = await Promise.all(
          (rolesData || []).map(async (role) => {
            const r = await fetchWithAuth(`/api/am/role-submissions/${role.id}`);
            if (!r.ok) return { roleId: role.id, under_consideration: [], rejected: [] };
            const payload = await r.json();
            return { roleId: role.id, under_consideration: payload.under_consideration || [], rejected: payload.rejected || [] };
          })
        );

        const map: Record<number, { under_consideration: RoleSubmission[]; rejected: RoleSubmission[] }> = {};
        for (const item of results) {
          map[item.roleId] = { under_consideration: item.under_consideration, rejected: item.rejected };
        }
        setDataByRole(map);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [clientId, teamId, selectedStatus]);

  const totals = useMemo(() => {
    let submittedToClient = 0;
    let discarded = 0;
    let clientRejected = 0;
    for (const roleId of Object.keys(dataByRole)) {
      submittedToClient += (dataByRole[Number(roleId)].under_consideration || []).filter((r) => r.association_status === 'client_submitted' && r.is_discarded !== 1).length;
      clientRejected += (dataByRole[Number(roleId)].under_consideration || []).filter((r) => r.association_status === 'client_rejected' && r.is_discarded !== 1).length;
      discarded += (dataByRole[Number(roleId)].rejected || []).length;
    }
    return { submittedToClient, clientRejected, discarded };
  }, [dataByRole]);
  const exportRoleRows = (roleId: number, roleCode: string) => {
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
  };

  const discardCandidate = async (roleId: number, candidateId: number) => {
    const res = await fetchWithAuth(`/api/am/roles/${roleId}/candidates/${candidateId}/discard`, {
      method: "POST",
      body: JSON.stringify({ reason: "Discarded via Pipe" }),
    });
    if (res.ok) {
      const r = await fetchWithAuth(`/api/am/role-submissions/${roleId}`);
      if (r.ok) {
        const payload = await r.json();
        setDataByRole((prev) => ({ ...prev, [roleId]: { under_consideration: payload.under_consideration || [], rejected: payload.rejected || [] } }));
      }
    }
  };

  const submitToClient = async (roleId: number, candidateId: number) => {
    const res = await fetchWithAuth(`/api/am/roles/${roleId}/candidates/${candidateId}/submit-to-client`, {
      method: "POST",
    });
    if (res.ok) {
      const r = await fetchWithAuth(`/api/am/role-submissions/${roleId}`);
      if (r.ok) {
        const payload = await r.json();
        setDataByRole((prev) => ({ ...prev, [roleId]: { under_consideration: payload.under_consideration || [], rejected: payload.rejected || [] } }));
      }
    }
  };

  const clientReject = async (roleId: number, candidateId: number) => {
    const res = await fetchWithAuth(`/api/am/roles/${roleId}/candidates/${candidateId}/client-reject`, {
      method: "POST",
    });
    if (res.ok) {
      const r = await fetchWithAuth(`/api/am/role-submissions/${roleId}`);
      if (r.ok) {
        const payload = await r.json();
        setDataByRole((prev) => ({ ...prev, [roleId]: { under_consideration: payload.under_consideration || [], rejected: payload.rejected || [] } }));
      }
    }
  };

  const markDeal = async (roleId: number, candidateId: number) => {
    const res = await fetchWithAuth(`/api/am/roles/${roleId}/candidates/${candidateId}/deal`, {
      method: "POST",
    });
    if (res.ok) {
      const r = await fetchWithAuth(`/api/am/role-submissions/${roleId}`);
      if (r.ok) {
        const payload = await r.json();
        setDataByRole((prev) => ({ ...prev, [roleId]: { under_consideration: payload.under_consideration || [], rejected: payload.rejected || [] } }));
      }
    }
  };

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
            <p className="text-sm text-red-700 font-semibold">Discarded</p>
            <p className="text-2xl font-bold text-red-700">{totals.discarded}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : roles.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No active roles found</p>
        </div>
      ) : (
        <div className="space-y-6">
          {roles.map((role) => {
            const bucket = dataByRole[role.id] || { under_consideration: [], rejected: [] };
            return (
              <div key={role.id} className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{role.title}</h3>
                    <p className="text-xs text-gray-600 font-mono">{role.role_code}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-1">
                      In Pipe: {bucket.under_consideration.length}
                    </span>
                    <span className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-1">
                      Discarded: {bucket.rejected.length}
                    </span>
                    <button
                      onClick={() => exportRoleRows(role.id, role.role_code)}
                      className="flex items-center gap-1 text-sm px-3 py-1 rounded border border-gray-200 text-gray-700 hover:bg-gray-50"
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
                        const rows = [...bucket.under_consideration.map((r) => ({ ...r })), ...bucket.rejected.map((r) => ({ ...r }))];
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
                          <tr key={row.association_id || `${row.candidate_id}-${row.submission_id || 0}`} className="border-b border-gray-100 hover:bg-gray-50">
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
                                  <button
                                    className="w-full text-left px-2 py-1 text-sm hover:bg-gray-50 rounded"
                                    onClick={() => {
                                      setOpenMenuFor(null);
                                      submitToClient(role.id, row.candidate_id!);
                                    }}
                                  >
                                    Submitted to Client
                                  </button>
                                  <button
                                    className="w-full text-left px-2 py-1 text-sm hover:bg-gray-50 rounded"
                                    onClick={() => {
                                      setOpenMenuFor(null);
                                      clientReject(role.id, row.candidate_id!);
                                    }}
                                  >
                                    Client Rejected
                                  </button>
                                  <button
                                    className="w-full text-left px-2 py-1 text-sm hover:bg-gray-50 rounded"
                                    onClick={() => {
                                      setOpenMenuFor(null);
                                      markDeal(role.id, row.candidate_id!);
                                    }}
                                  >
                                    Deal
                                  </button>
                                  <button
                                    className="w-full text-left px-2 py-1 text-sm hover:bg-gray-50 rounded text-red-600"
                                    onClick={() => {
                                      setOpenMenuFor(null);
                                      discardCandidate(role.id, row.candidate_id!);
                                    }}
                                  >
                                    Discard
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right">
                              {row.is_discarded !== 1 ? (
                                <button
                                  className="text-xs px-3 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50"
                                  onClick={() => discardCandidate(role.id, row.candidate_id!)}
                                >
                                  Discard
                                </button>
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
  );
}
