import { useState, useEffect } from "react";
import { Plus, Briefcase } from "lucide-react";
import CreateRoleModal from "./CreateRoleModal";
import EditRoleModal from "./EditRoleModal";
import DeleteRoleModal from "./DeleteRoleModal";
import ChangeStatusModal from "./ChangeStatusModal";
import AddInterviewModal from "./AddInterviewModal";
import RoleCard from "./RoleCard";
import { fetchWithAuth } from "@/react-app/utils/api";

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
    </div>
  );
}
