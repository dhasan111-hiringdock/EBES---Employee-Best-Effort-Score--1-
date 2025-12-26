import { useState, useEffect } from 'react';
import { Users, Plus, Trash2, UserCheck, X, Edit } from 'lucide-react';
import { fetchWithAuth } from '@/react-app/utils/api';

interface Team {
  id: number;
  name: string;
  team_code: string;
}

interface Recruiter {
  id: number;
  name: string;
  email: string;
  user_code: string;
  assigned_at?: string;
}

export default function RMTeamManagement() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamRecruiters, setTeamRecruiters] = useState<Recruiter[]>([]);
  const [availableRecruiters, setAvailableRecruiters] = useState<Recruiter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRecruiter, setSelectedRecruiter] = useState<string>('');
  const [editingRecruiter, setEditingRecruiter] = useState<Recruiter | null>(null);
  const [newTeamId, setNewTeamId] = useState<string>('');

  useEffect(() => {
    fetchTeams();
  }, []);

  useEffect(() => {
    if (selectedTeam) {
      fetchTeamRecruiters();
      fetchAvailableRecruiters();
    }
  }, [selectedTeam]);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const response = await fetchWithAuth('/api/rm/teams');
      if (response.ok) {
        const data = await response.json();
        setTeams(data);
        if (data.length > 0 && !selectedTeam) {
          setSelectedTeam(data[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamRecruiters = async () => {
    if (!selectedTeam) return;

    try {
      const response = await fetchWithAuth(`/api/rm/team-recruiters/${selectedTeam.id}`);
      if (response.ok) {
        const data = await response.json();
        setTeamRecruiters(data);
      }
    } catch (error) {
      console.error('Failed to fetch team recruiters:', error);
    }
  };

  const fetchAvailableRecruiters = async () => {
    if (!selectedTeam) return;

    try {
      const response = await fetchWithAuth(`/api/rm/available-recruiters?team_id=${selectedTeam.id}`);
      if (response.ok) {
        const data = await response.json();
        setAvailableRecruiters(data);
      }
    } catch (error) {
      console.error('Failed to fetch available recruiters:', error);
    }
  };

  const handleAddRecruiter = async () => {
    if (!selectedRecruiter || !selectedTeam) return;

    try {
      const response = await fetchWithAuth('/api/rm/team-recruiters', {
        method: 'POST',
        body: JSON.stringify({
          team_id: selectedTeam.id,
          recruiter_user_id: parseInt(selectedRecruiter)
        })
      });

      if (response.ok) {
        setShowAddModal(false);
        setSelectedRecruiter('');
        fetchTeamRecruiters();
        fetchAvailableRecruiters();
      }
    } catch (error) {
      console.error('Failed to add recruiter:', error);
    }
  };

  const handleEditRecruiter = (recruiter: Recruiter) => {
    setEditingRecruiter(recruiter);
    setNewTeamId('');
    setShowEditModal(true);
  };

  const handleUpdateRecruiterTeam = async () => {
    if (!editingRecruiter || !selectedTeam || !newTeamId) return;

    const newTeamIdNum = parseInt(newTeamId);
    if (newTeamIdNum === selectedTeam.id) {
      alert('Recruiter is already in this team');
      return;
    }

    try {
      // Remove from current team
      const removeResponse = await fetchWithAuth(
        `/api/rm/team-recruiters/${selectedTeam.id}/${editingRecruiter.id}`,
        { method: 'DELETE' }
      );

      if (!removeResponse.ok) {
        throw new Error('Failed to remove recruiter from current team');
      }

      // Add to new team
      const addResponse = await fetchWithAuth('/api/rm/team-recruiters', {
        method: 'POST',
        body: JSON.stringify({
          team_id: newTeamIdNum,
          recruiter_user_id: editingRecruiter.id
        })
      });

      if (!addResponse.ok) {
        // Try to re-add to old team if new assignment fails
        await fetchWithAuth('/api/rm/team-recruiters', {
          method: 'POST',
          body: JSON.stringify({
            team_id: selectedTeam.id,
            recruiter_user_id: editingRecruiter.id
          })
        });
        throw new Error('Failed to add recruiter to new team');
      }

      setShowEditModal(false);
      setEditingRecruiter(null);
      setNewTeamId('');
      fetchTeamRecruiters();
      fetchAvailableRecruiters();
    } catch (error) {
      console.error('Failed to update recruiter team:', error);
      alert('Failed to update recruiter team assignment');
    }
  };

  const handleRemoveRecruiter = async (recruiterId: number) => {
    if (!selectedTeam) return;
    if (!confirm('Are you sure you want to remove this recruiter from the team?')) return;

    try {
      const response = await fetchWithAuth(`/api/rm/team-recruiters/${selectedTeam.id}/${recruiterId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchTeamRecruiters();
        fetchAvailableRecruiters();
      }
    } catch (error) {
      console.error('Failed to remove recruiter:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Team Management</h2>
          <p className="text-slate-500 mt-1">Manage recruiters in your teams</p>
        </div>
      </div>

      {/* Team Selector */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
        <label className="block text-sm font-medium text-slate-700 mb-3">Select Team</label>
        <select
          value={selectedTeam?.id || ''}
          onChange={(e) => {
            const team = teams.find(t => t.id === parseInt(e.target.value));
            setSelectedTeam(team || null);
          }}
          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-lg"
        >
          {teams.map(team => (
            <option key={team.id} value={team.id}>
              {team.name} ({team.team_code})
            </option>
          ))}
        </select>
      </div>

      {selectedTeam && (
        <>
          {/* Team Info Card */}
          <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold">{selectedTeam.name}</h3>
                <p className="text-indigo-100 mt-1 font-mono">{selectedTeam.team_code}</p>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold">{teamRecruiters.length}</div>
                <div className="text-indigo-100 text-sm">Recruiters</div>
              </div>
            </div>
          </div>

          {/* Recruiters List */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-slate-800">Team Recruiters</h3>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Recruiter
              </button>
            </div>

            {teamRecruiters.length === 0 ? (
              <div className="text-center py-12">
                <UserCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No recruiters assigned to this team</p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="mt-4 text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Add your first recruiter
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {teamRecruiters.map((recruiter) => (
                  <div key={recruiter.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                        {recruiter.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{recruiter.name}</p>
                        <p className="text-sm text-slate-500">{recruiter.email}</p>
                        <p className="text-xs text-slate-400 font-mono">{recruiter.user_code}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {recruiter.assigned_at && (
                        <div className="text-right text-sm text-slate-500">
                          <p>Added</p>
                          <p>{new Date(recruiter.assigned_at).toLocaleDateString()}</p>
                        </div>
                      )}
                      <button
                        onClick={() => handleEditRecruiter(recruiter)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Change team"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRemoveRecruiter(recruiter.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove from team"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Add Recruiter Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-800">Add Recruiter to Team</h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedRecruiter('');
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Select Recruiter
                </label>
                <select
                  value={selectedRecruiter}
                  onChange={(e) => setSelectedRecruiter(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Choose a recruiter...</option>
                  {availableRecruiters.map((recruiter) => (
                    <option key={recruiter.id} value={recruiter.id}>
                      {recruiter.name} ({recruiter.user_code})
                    </option>
                  ))}
                </select>
                {availableRecruiters.length === 0 && (
                  <p className="text-sm text-slate-500 mt-2">
                    No available recruiters. All recruiters are already assigned to this team.
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setSelectedRecruiter('');
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddRecruiter}
                  disabled={!selectedRecruiter}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add to Team
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Recruiter Team Modal */}
      {showEditModal && editingRecruiter && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-800">Change Team Assignment</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingRecruiter(null);
                  setNewTeamId('');
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm text-slate-600 mb-1">Recruiter</p>
                <p className="font-semibold text-slate-800">{editingRecruiter.name}</p>
                <p className="text-sm text-slate-500 font-mono">{editingRecruiter.user_code}</p>
              </div>

              <div className="bg-indigo-50 rounded-lg p-4">
                <p className="text-sm text-indigo-600 mb-1">Current Team</p>
                <p className="font-semibold text-indigo-800">
                  {selectedTeam?.name} ({selectedTeam?.team_code})
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Move to Team
                </label>
                <select
                  value={newTeamId}
                  onChange={(e) => setNewTeamId(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select a team...</option>
                  {teams
                    .filter(team => team.id !== selectedTeam?.id)
                    .map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name} ({team.team_code})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingRecruiter(null);
                    setNewTeamId('');
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateRecruiterTeam}
                  disabled={!newTeamId}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Move to Team
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
