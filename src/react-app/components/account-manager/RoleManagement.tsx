import { useState, useEffect } from "react";
import { Plus, Briefcase, X, CheckCircle, Save } from "lucide-react";
import CreateRoleModal from "./CreateRoleModal";
import EditRoleModal from "./EditRoleModal";
import DeleteRoleModal from "./DeleteRoleModal";
import ChangeStatusModal from "./ChangeStatusModal";
import AddInterviewModal from "./AddInterviewModal";
import RoleCard from "./RoleCard";
import { fetchWithAuth, amDiscardCandidate, amSubmitCandidateToClient, amClientRejectCandidate, amPullOutCandidate, amMarkDeal, amReviewSubmission } from "@/react-app/utils/api";

interface Role {
  id: number;
  role_code: string;
  title: string;
  description: string;
  status: string;
  client_id: number;
  client_name: string;
  team_id: number;
  team_name: string;
  interview_1_count: number;
  interview_2_count: number;
  interview_3_count: number;
  total_interviews: number;
  total_submissions: number;
  under_client_evaluation?: number;
  client_rejected?: number;
  has_dropout?: boolean;
  dropout_decision?: string;
}

interface RoleManagementProps {
  clientId: number;
  teamId: number;
}

export default function RoleManagement({ clientId, teamId }: RoleManagementProps) {
  const [activeTab, setActiveTab] = useState<"active" | "non-active">("active");
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);
  const [changingStatusRole, setChangingStatusRole] = useState<Role | null>(null);
  const [addingInterviewRole, setAddingInterviewRole] = useState<Role | null>(null);
  const [submissionsRole, setSubmissionsRole] = useState<Role | null>(null);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [roleSubmissions, setRoleSubmissions] = useState<{ under_consideration: any[]; rejected: any[] }>({ under_consideration: [], rejected: [] });
  const [notesEdits, setNotesEdits] = useState<Record<number, string>>({});

  const underCons = roleSubmissions.under_consideration || [];
  

  const renderSubmissionRow = (item: any) => (
    <tr key={item.association_id} className="border-b border-gray-200 hover:bg-gray-50">
      <td className="py-2 px-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900">{item.candidate_name}</span>
          <span className="text-xs text-gray-500 font-mono">{item.candidate_code || item.candidate_id}</span>
          {(() => {
            const s = (item as any).association_status;
            if (s === 'submitted') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">Submitted to AM</span>;
            if (s === 'client_submitted') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-100 text-blue-800 border border-blue-200">Submitted to Client</span>;
            if (s === 'client_rejected') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-red-100 text-red-800 border border-red-200">Client Rejected</span>;
            if (s === 'rm_evaluation') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">Pending Evaluation</span>;
            if (s === 'deal') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-green-100 text-green-800 border border-green-200">Deal</span>;
            return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">In Play</span>;
          })()}
        </div>
        <div className="text-xs text-gray-600 mt-1">{item.candidate_email || 'No email'} · {item.candidate_phone || 'No phone'}</div>
        <div className="text-xs text-gray-500 mt-1">Submitted on {item.submission_date ? new Date(item.submission_date).toLocaleDateString() : 'N/A'}</div>
      </td>
      <td className="py-2 px-3 text-sm">{item.rm_location || '-'}</td>
      <td className="py-2 px-3 text-sm">{item.rm_work_type || '-'}</td>
      <td className="py-2 px-3 text-sm">{item.rm_validation_status || '-'}</td>
      <td className="py-2 px-3 text-sm">{item.rm_rate_bill ? `Bill: ${item.rm_rate_bill}` : '-'}{item.rm_rate_pay ? ` · Pay: ${item.rm_rate_pay}` : ''}</td>
      <td className="py-2 px-3 text-sm">{item.score != null ? Number(item.score).toFixed(2) : '-'}</td>
      <td className="py-2 px-3 text-sm">
        {item.candidate_resume_url && (
          <a href={item.candidate_resume_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:text-indigo-800">View CV</a>
        )}
      </td>
      <td className="py-2 px-3">
        <textarea
          placeholder="Add notes"
          defaultValue={item.am_notes || ''}
          onChange={(e) => setNotesEdits(prev => ({ ...prev, [(item.submission_id || 0)]: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          rows={2}
          disabled={!item.submission_id}
        />
      </td>
      <td className="py-2 px-3">
        <div className="flex items-center gap-2">
          {item.association_status === 'deal' ? (
            <span className="px-3 py-2 text-xs text-green-700 border border-green-200 rounded-lg bg-green-50 justify-center flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              Deal
            </span>
          ) : (
            <select
              defaultValue=""
              onChange={(e) => {
                const v = e.target.value;
                if (!v || !submissionsRole) return;
                const roleId = submissionsRole.id;
                if (item.association_status === 'client_submitted') {
                  if (v === 'client_reject') clientReject(roleId, item.candidate_id);
                  else if (v === 'pull_out') pullOut(roleId, item.candidate_id);
                  else if (v === 'deal') markDeal(roleId, item.candidate_id);
                } else {
                  if (v === 'submit_to_client') submitToClient(roleId, item.candidate_id);
                  else if (v === 'reject') discardCandidate(roleId, item.candidate_id);
                }
                e.currentTarget.value = '';
              }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
            >
              <option value="" disabled>Choose Action</option>
              {item.association_status === 'client_submitted' ? (
                <>
                  <option value="client_reject">Client Rejected</option>
                  <option value="pull_out">Pull Out</option>
                  <option value="deal">Deal</option>
                </>
              ) : (
                <>
                  <option value="submit_to_client">Submit to Client</option>
                  <option value="reject">Discard</option>
                </>
              )}
            </select>
          )}
        </div>
      </td>
      <td className="py-2 px-3 text-right">
        <button
          onClick={() => saveNotes(item.submission_id)}
          disabled={!item.submission_id}
          className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1 disabled:opacity-50 justify-center ml-auto"
        >
          <Save className="w-4 h-4" />
          Save
        </button>
      </td>
    </tr>
  );

  

  useEffect(() => {
    fetchRoles();
  }, [activeTab, clientId, teamId]);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: activeTab,
        client_id: clientId.toString(),
        team_id: teamId.toString(),
      });
      const response = await fetchWithAuth(`/api/am/roles?${params}`);
      if (response.ok) {
        const data = await response.json();
        setRoles(data);
      }
    } catch (error) {
      console.error("Failed to fetch roles:", error);
    } finally {
      setLoading(false);
    }
  };

  const activeRolesCount = activeTab === "active" ? roles.length : 0;
  const showLimitWarning = activeRolesCount >= 25;

  const openSubmissions = (role: Role) => {
    setSubmissionsRole(role);
    loadRoleSubmissions(role.id);
  };

  const loadRoleSubmissions = async (roleId: number) => {
    try {
      setLoadingSubmissions(true);
      const res = await fetchWithAuth(`/api/am/role-submissions/${roleId}`);
      if (res.ok) {
        const data = await res.json();
        setRoleSubmissions(data);
      }
    } catch (e) {
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const discardCandidate = async (roleId: number, candidateId: number) => {
    const res = await amDiscardCandidate(roleId, candidateId, undefined);
    if (res.ok && submissionsRole) {
      await loadRoleSubmissions(submissionsRole.id);
    }
  };

  const saveNotes = async (submissionId?: number) => {
    if (!submissionId) return;
    const res = await amReviewSubmission(submissionId, { am_notes: notesEdits[submissionId] || '' });
    if (res.ok && submissionsRole) {
      await loadRoleSubmissions(submissionsRole.id);
    }
  };

  const submitToClient = async (roleId: number, candidateId: number) => {
    const res = await amSubmitCandidateToClient(roleId, candidateId);
    if (res.ok && submissionsRole) {
      await loadRoleSubmissions(submissionsRole.id);
      await fetchRoles();
    }
  };

  const clientReject = async (roleId: number, candidateId: number) => {
    const res = await amClientRejectCandidate(roleId, candidateId);
    if (res.ok && submissionsRole) {
      await loadRoleSubmissions(submissionsRole.id);
      await fetchRoles();
    }
  };

  const pullOut = async (roleId: number, candidateId: number) => {
    const res = await amPullOutCandidate(roleId, candidateId);
    if (res.ok && submissionsRole) {
      await loadRoleSubmissions(submissionsRole.id);
      await fetchRoles();
    }
  };

  const markDeal = async (roleId: number, candidateId: number) => {
    const res = await amMarkDeal(roleId, candidateId);
    if (res.ok && submissionsRole) {
      await loadRoleSubmissions(submissionsRole.id);
      await fetchRoles();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Role Management</h2>
          <p className="text-gray-600 mt-1">
            Manage roles and track interview progress
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create Role
        </button>
      </div>

      {showLimitWarning && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800 font-medium">
            ⚠️ You have {activeRolesCount} active roles. You can have a maximum of 30 active
            roles. Please update role statuses to free up slots.
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab("active")}
              className={`flex-1 px-6 py-4 font-medium transition-colors ${
                activeTab === "active"
                  ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              Active Roles
            </button>
            <button
              onClick={() => setActiveTab("non-active")}
              className={`flex-1 px-6 py-4 font-medium transition-colors ${
                activeTab === "non-active"
                  ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              Non-Active Roles
            </button>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          ) : roles.length === 0 ? (
            <div className="text-center py-12">
              <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">
                No {activeTab === "active" ? "active" : "non-active"} roles found
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Create a new role to get started
              </p>
            </div>
          ) : activeTab === "active" ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {roles.map((role) => (
                <RoleCard
                  key={role.id}
                  role={role}
                  onEdit={() => setEditingRole(role)}
                  onDelete={() => setDeletingRole(role)}
                  onChangeStatus={() => setChangingStatusRole(role)}
                  onAddInterview={() => setAddingInterviewRole(role)}
                  onViewSubmissions={() => openSubmissions(role)}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Role Code</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Title</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Int 1</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Int 2</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Int 3</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Total</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => (
                    <tr key={role.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-indigo-600">
                            {role.role_code}
                          </span>
                          {role.has_dropout && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded border border-red-200">
                              Dropped Out
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-gray-900">{role.title}</p>
                          {role.description && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-1">{role.description}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          role.status === "deal"
                            ? "bg-green-100 text-green-700 border border-green-200"
                            : role.status === "lost"
                            ? "bg-red-100 text-red-700 border border-red-200"
                            : role.status === "on_hold"
                            ? "bg-yellow-100 text-yellow-700 border border-yellow-200"
                            : role.status === "cancelled"
                            ? "bg-gray-100 text-gray-700 border border-gray-200"
                            : role.status === "no_answer"
                            ? "bg-orange-100 text-orange-700 border border-orange-200"
                            : "bg-blue-100 text-blue-700 border border-blue-200"
                        }`}>
                          {role.status === "deal" ? "Deal" :
                           role.status === "lost" ? "Lost" :
                           role.status === "on_hold" ? "On Hold" :
                           role.status === "cancelled" ? "Cancelled" :
                           role.status === "no_answer" ? "No Answer" :
                           role.status}
                        </span>
                      </td>
                      <td className="text-center py-3 px-4 font-semibold text-gray-700">
                        {role.interview_1_count}
                      </td>
                      <td className="text-center py-3 px-4 font-semibold text-gray-700">
                        {role.interview_2_count}
                      </td>
                      <td className="text-center py-3 px-4 font-semibold text-gray-700">
                        {role.interview_3_count}
                      </td>
                      <td className="text-center py-3 px-4 font-semibold text-indigo-600">
                        {role.total_interviews}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setAddingInterviewRole(role)}
                            className="px-3 py-1 text-xs bg-teal-50 text-teal-700 hover:bg-teal-100 rounded border border-teal-200 transition-colors"
                            title="Add Interview"
                          >
                            + Interview
                          </button>
                          <button
                            onClick={() => setChangingStatusRole(role)}
                            className="px-3 py-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 rounded border border-blue-200 transition-colors"
                            title="Change Status"
                          >
                            Status
                          </button>
                          <button
                            onClick={() => setEditingRole(role)}
                            className="px-3 py-1 text-xs bg-gray-50 text-gray-700 hover:bg-gray-100 rounded border border-gray-200 transition-colors"
                            title="Edit"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeletingRole(role)}
                            className="px-3 py-1 text-xs bg-red-50 text-red-700 hover:bg-red-100 rounded border border-red-200 transition-colors"
                            title="Delete"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {isCreateModalOpen && (
        <CreateRoleModal
          onClose={() => setIsCreateModalOpen(false)}
          onRoleCreated={() => {
            fetchRoles();
            setIsCreateModalOpen(false);
          }}
        />
      )}

      {editingRole && (
        <EditRoleModal
          role={editingRole}
          onClose={() => setEditingRole(null)}
          onRoleUpdated={() => {
            fetchRoles();
            setEditingRole(null);
          }}
        />
      )}

      {deletingRole && (
        <DeleteRoleModal
          role={deletingRole}
          onClose={() => setDeletingRole(null)}
          onRoleDeleted={() => {
            fetchRoles();
            setDeletingRole(null);
          }}
        />
      )}

      {changingStatusRole && (
        <ChangeStatusModal
          role={changingStatusRole}
          onClose={() => setChangingStatusRole(null)}
          onStatusChanged={() => {
            fetchRoles();
            setChangingStatusRole(null);
          }}
        />
      )}

      {addingInterviewRole && (
        <AddInterviewModal
          role={addingInterviewRole}
          onClose={() => setAddingInterviewRole(null)}
          onInterviewAdded={() => {
            fetchRoles();
            setAddingInterviewRole(null);
          }}
        />
      )}
      
      {submissionsRole && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
            <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4 flex items-center justify-between text-white">
              <div>
                <h3 className="text-xl font-bold">Role Details</h3>
                <p className="text-indigo-100 text-xs mt-1 font-mono">{submissionsRole.role_code}</p>
              </div>
              <button onClick={() => setSubmissionsRole(null)} className="p-2 rounded hover:bg-white/20">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-64px)]">
              <div className="space-y-6">
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">{submissionsRole.title}</h3>
                      </div>
                      <p className="text-xs text-gray-600 font-mono">{submissionsRole.role_code}</p>
                    </div>
                    <div className={`px-3 py-1 rounded-full border text-xs font-medium ${
                      submissionsRole.status === "deal" ? "bg-blue-100 text-blue-700 border-blue-200" :
                      submissionsRole.status === "lost" ? "bg-red-100 text-red-700 border-red-200" :
                      submissionsRole.status === "on_hold" ? "bg-yellow-100 text-yellow-700 border-yellow-200" :
                      submissionsRole.status === "cancelled" ? "bg-gray-100 text-gray-700 border-gray-200" :
                      submissionsRole.status === "no_answer" ? "bg-purple-100 text-purple-700 border-purple-200" :
                      "bg-green-100 text-green-700 border-green-200"
                    }`}>
                      {submissionsRole.status === "deal" ? "Deal" :
                       submissionsRole.status === "lost" ? "Lost" :
                       submissionsRole.status === "on_hold" ? "On Hold" :
                       submissionsRole.status === "cancelled" ? "Cancelled" :
                       submissionsRole.status === "no_answer" ? "No Answer" :
                       "Active"}
                    </div>
                  </div>
                  {submissionsRole.description && (
                    <p className="text-sm text-gray-600 mb-3">{submissionsRole.description}</p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <p className="text-xs text-gray-700 mb-1 font-semibold">Client</p>
                      <p className="text-sm font-medium text-gray-900">{submissionsRole.client_name}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <p className="text-xs text-gray-700 mb-1 font-semibold">Team</p>
                      <p className="text-sm font-medium text-gray-900">{submissionsRole.team_name}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                      <p className="text-xs text-indigo-700 mb-1 font-semibold">Total Submissions</p>
                      <p className="text-2xl font-bold text-indigo-600">{submissionsRole.total_submissions ?? 0}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                      <p className="text-xs text-blue-700 mb-1 font-semibold">Submitted to Client</p>
                      <p className="text-2xl font-bold text-blue-600">{submissionsRole.under_client_evaluation ?? 0}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <p className="text-xs text-gray-700 mb-1 font-semibold">Client Rejected</p>
                      <p className="text-2xl font-bold text-gray-900">{submissionsRole.client_rejected ?? 0}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-indigo-600" />
                    <span className="font-semibold text-gray-800">Submitted Candidates</span>
                  </div>
                  {loadingSubmissions && <span className="text-sm text-gray-500">Loading…</span>}
                </div>
              </div>
              {roleSubmissions.under_consideration.length === 0 && roleSubmissions.rejected.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-xl">
                  <Briefcase className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600">No submissions yet</p>
                </div>
              ) : (
                <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700">Candidate</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700">Location</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700">Contract Type</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700">Rates</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700">Score (0–5)</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700">Status</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700">Submitted</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700">CV</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700">Notes</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700">Action</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-700">Save</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...underCons, ...roleSubmissions.rejected].map((item: any) => renderSubmissionRow(item))}
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
