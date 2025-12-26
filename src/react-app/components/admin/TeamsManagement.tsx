import { useState, useEffect } from "react";
import { Plus, UsersRound, Search, Edit, Trash2 } from "lucide-react";
import EditTeamModal from "./EditTeamModal";
import DeleteConfirmModal from "./DeleteConfirmModal";
import type { Team } from "@/shared/types";
import { fetchWithAuth } from "@/react-app/utils/api";

export default function TeamsManagement() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({ name: "" });
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const response = await fetchWithAuth("/api/admin/teams");
      if (response.ok) {
        const data = await response.json();
        setTeams(data);
      }
    } catch (error) {
      console.error("Failed to fetch teams:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetchWithAuth("/api/admin/teams", {
        method: "POST",
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        setCreatedCode(data.team_code);
        setTimeout(() => {
          fetchTeams();
          setIsCreateModalOpen(false);
          setFormData({ name: "" });
          setCreatedCode(null);
        }, 2000);
      }
    } catch (error) {
      console.error("Failed to create team:", error);
    }
  };

  const handleTeamUpdated = () => {
    fetchTeams();
    setEditingTeam(null);
  };

  const handleDeleteTeam = async () => {
    if (!deletingTeam) return;

    const response = await fetchWithAuth(`/api/admin/teams/${deletingTeam.id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      fetchTeams();
      setDeletingTeam(null);
    } else {
      throw new Error("Failed to delete team");
    }
  };

  const filteredTeams = teams.filter((team) =>
    team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    team.team_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Teams Management</h2>
          <p className="text-gray-600 mt-1">Manage recruitment teams</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Team
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search teams..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeams.map((team) => (
            <div
              key={team.id}
              className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <UsersRound className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{team.name}</h3>
                  <p className="text-xs text-gray-600 font-mono mt-1">{team.team_code}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditingTeam(team)}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Edit team"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeletingTeam(team)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete team"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredTeams.length === 0 && (
          <div className="text-center py-12">
            <UsersRound className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No teams found</p>
          </div>
        )}
      </div>

      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            {createdCode ? (
              <div className="text-center space-y-4">
                <div className="text-green-500 text-5xl">✓</div>
                <h3 className="text-2xl font-bold text-gray-900">Team Created!</h3>
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Team Code</p>
                  <p className="text-3xl font-bold text-blue-600 font-mono">{createdCode}</p>
                </div>
              </div>
            ) : (
              <>
                <h3 className="text-2xl font-bold text-gray-900 mb-6">Add New Team</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Team Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreateModalOpen(false);
                        setFormData({ name: "" });
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      Create Team
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {editingTeam && (
        <EditTeamModal
          team={editingTeam}
          onClose={() => setEditingTeam(null)}
          onTeamUpdated={handleTeamUpdated}
        />
      )}

      {deletingTeam && (
        <DeleteConfirmModal
          title="Delete Team"
          message={`Are you sure you want to delete ${deletingTeam.name}? This action cannot be undone.`}
          onClose={() => setDeletingTeam(null)}
          onConfirm={handleDeleteTeam}
        />
      )}
    </div>
  );
}
