import { useState, useEffect } from "react";
import { X, Building2, Users, Plus, Trash2 } from "lucide-react";
import { fetchWithAuth } from "@/react-app/utils/api";

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

interface Role {
  id: number;
  role_code: string;
  title: string;
  description: string;
  status: string;
  client_id: number;
  team_id: number;
  additional_teams?: Team[];
}

interface EditRoleModalProps {
  role: Role;
  onClose: () => void;
  onRoleUpdated: () => void;
}

export default function EditRoleModal({ role, onClose, onRoleUpdated }: EditRoleModalProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<number[]>([]);
  const [formData, setFormData] = useState({
    title: role.title,
    description: role.description,
    client_id: role.client_id.toString(),
    team_id: role.team_id.toString(),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAssignments();
    // Initialize selected teams with existing additional teams
    if (role.additional_teams && role.additional_teams.length > 0) {
      setSelectedTeams(role.additional_teams.map(t => t.id));
    }
  }, [role]);

  const fetchAssignments = async () => {
    try {
      const response = await fetchWithAuth('/api/am/assignments');
      if (response.ok) {
        const data = await response.json();
        setClients(data.clients || []);
        setTeams(data.teams || []);
      }
    } catch (err) {
      console.error('Failed to fetch assignments:', err);
    }
  };

  const handleAddTeam = () => {
    // Find a team that's not already selected
    const availableTeam = teams.find(
      t => t.id.toString() !== formData.team_id && !selectedTeams.includes(t.id)
    );
    if (availableTeam) {
      setSelectedTeams([...selectedTeams, availableTeam.id]);
    }
  };

  const handleRemoveTeam = (teamId: number) => {
    setSelectedTeams(selectedTeams.filter(id => id !== teamId));
  };

  const handleTeamChange = (index: number, newTeamId: number) => {
    const newSelectedTeams = [...selectedTeams];
    newSelectedTeams[index] = newTeamId;
    setSelectedTeams(newSelectedTeams);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Combine primary team and additional teams
      const allTeamIds = [parseInt(formData.team_id), ...selectedTeams];

      const response = await fetchWithAuth(`/api/am/roles/${role.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          client_id: parseInt(formData.client_id),
          team_id: parseInt(formData.team_id),
          team_ids: allTeamIds,
        }),
      });

      if (response.ok) {
        onRoleUpdated();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to update role");
      }
    } catch (err) {
      setError("An error occurred while updating the role");
    } finally {
      setLoading(false);
    }
  };

  const availableTeamsForAdd = teams.filter(
    t => t.id.toString() !== formData.team_id && !selectedTeams.includes(t.id)
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4 rounded-t-2xl flex justify-between items-center sticky top-0 z-10">
          <div>
            <h3 className="text-xl font-bold text-white">Edit Role</h3>
            <p className="text-sm text-indigo-100 font-mono mt-1">{role.role_code}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-1.5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Building2 className="w-4 h-4 inline mr-1" />
              Client <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.client_id}
              onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none bg-white"
              required
            >
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.name} ({client.client_code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Users className="w-4 h-4 inline mr-1" />
              Primary Team <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.team_id}
              onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none bg-white"
              required
            >
              {teams.map(team => (
                <option key={team.id} value={team.id}>
                  {team.name} ({team.team_code})
                </option>
              ))}
            </select>
          </div>

          {/* Additional Teams Section */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                <Users className="w-4 h-4 inline mr-1" />
                Additional Teams
              </label>
              {availableTeamsForAdd.length > 0 && (
                <button
                  type="button"
                  onClick={handleAddTeam}
                  className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-200"
                >
                  <Plus className="w-3 h-3" />
                  Add Team
                </button>
              )}
            </div>
            
            {selectedTeams.length > 0 ? (
              <div className="space-y-2">
                {selectedTeams.map((teamId, index) => (
                  <div key={index} className="flex gap-2">
                    <select
                      value={teamId}
                      onChange={(e) => handleTeamChange(index, parseInt(e.target.value))}
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none bg-white"
                    >
                      {teams
                        .filter(t => 
                          t.id === teamId || 
                          (t.id.toString() !== formData.team_id && !selectedTeams.includes(t.id))
                        )
                        .map(team => (
                          <option key={team.id} value={team.id}>
                            {team.name} ({team.team_code})
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleRemoveTeam(teamId)}
                      className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors border border-red-200"
                      title="Remove team"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">
                No additional teams assigned
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {loading ? "Updating..." : "Update Role"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
