import { useState, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import type { User, Team, Client } from "@/shared/types";
import { fetchWithAuth } from "@/react-app/utils/api";

interface RecruiterClientAssignment {
  id: number;
  client_id: number;
  client_name: string;
  client_code: string;
  team_id: number;
  team_name: string;
  team_code: string;
}

interface UserAssignmentsModalProps {
  user: User;
  onClose: () => void;
}

export default function UserAssignmentsModal({ user, onClose }: UserAssignmentsModalProps) {
  const [assignments, setAssignments] = useState<{ 
    teams: Team[]; 
    clients: Client[];
    recruiter_clients?: RecruiterClientAssignment[];
  }>({
    teams: [],
    clients: [],
  });
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [selectedClient, setSelectedClient] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, [user.id]);

  const fetchData = async () => {
    try {
      const [assignmentsRes, teamsRes, clientsRes] = await Promise.all([
        fetchWithAuth(`/api/admin/users/${user.id}/assignments`),
        fetchWithAuth("/api/admin/teams"),
        fetchWithAuth("/api/admin/clients"),
      ]);

      if (assignmentsRes.ok && teamsRes.ok && clientsRes.ok) {
        const assignmentsData = await assignmentsRes.json();
        const teamsData = await teamsRes.json();
        const clientsData = await clientsRes.json();

        setAssignments(assignmentsData);
        setAllTeams(teamsData);
        setAllClients(clientsData);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignTeam = async (teamId: number) => {
    try {
      const response = await fetchWithAuth("/api/admin/assign-team", {
        method: "POST",
        body: JSON.stringify({ user_id: user.id, team_id: teamId }),
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Failed to assign team:", error);
    }
  };

  const handleAssignClient = async (clientId: number) => {
    try {
      const response = await fetchWithAuth("/api/admin/assign-client", {
        method: "POST",
        body: JSON.stringify({ user_id: user.id, client_id: clientId }),
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Failed to assign client:", error);
    }
  };

  const handleUnassignTeam = async (teamId: number) => {
    try {
      const response = await fetchWithAuth("/api/admin/unassign-team", {
        method: "DELETE",
        body: JSON.stringify({ user_id: user.id, team_id: teamId }),
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Failed to unassign team:", error);
    }
  };

  const handleUnassignClient = async (clientId: number) => {
    try {
      const response = await fetchWithAuth("/api/admin/unassign-client", {
        method: "DELETE",
        body: JSON.stringify({ user_id: user.id, client_id: clientId }),
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Failed to unassign client:", error);
    }
  };

  // Recruiter-specific handlers
  const handleAssignRecruiterTeam = async (teamId: number) => {
    try {
      const response = await fetchWithAuth("/api/admin/assign-recruiter-team", {
        method: "POST",
        body: JSON.stringify({ recruiter_user_id: user.id, team_id: teamId }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.auto_assigned_client) {
          alert("Recruiter assigned to team and automatically assigned to the only available client!");
        }
        fetchData();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to assign team");
      }
    } catch (error) {
      console.error("Failed to assign team:", error);
    }
  };

  const handleUnassignRecruiterTeam = async (teamId: number) => {
    try {
      const response = await fetchWithAuth(`/api/admin/recruiter-team/${user.id}/${teamId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Failed to unassign team:", error);
    }
  };

  const handleAssignRecruiterClient = async () => {
    if (!selectedTeam || !selectedClient) {
      alert("Please select both team and client");
      return;
    }

    try {
      const response = await fetchWithAuth("/api/admin/assign-recruiter-client", {
        method: "POST",
        body: JSON.stringify({
          recruiter_user_id: user.id,
          client_id: selectedClient,
          team_id: selectedTeam,
        }),
      });

      if (response.ok) {
        setSelectedTeam(null);
        setSelectedClient(null);
        fetchData();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to assign client");
      }
    } catch (error) {
      console.error("Failed to assign client:", error);
    }
  };

  const handleUnassignRecruiterClient = async (recruiterId: number, clientId: number) => {
    try {
      const response = await fetchWithAuth(`/api/admin/recruiter-client/${recruiterId}/${clientId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Failed to unassign client:", error);
    }
  };

  const unassignedTeams = allTeams.filter(
    (team) => !assignments.teams.find((t) => t.id === team.id)
  );

  const unassignedClients = allClients.filter(
    (client) => !assignments.clients.find((c) => c.id === client.id)
  );

  const showTeams =
    user.role === "recruitment_manager" || user.role === "account_manager";
  const showClients = user.role === "account_manager" || user.role === "recruitment_manager";
  const isRecruiter = user.role === "recruiter";

  // Get teams recruiter is assigned to
  const recruiterTeams = isRecruiter && assignments.recruiter_clients
    ? Array.from(new Set(assignments.recruiter_clients.map(rc => rc.team_id))).map(teamId => {
        const assignment = assignments.recruiter_clients!.find(rc => rc.team_id === teamId)!;
        return {
          id: assignment.team_id,
          name: assignment.team_name,
          team_code: assignment.team_code,
        };
      })
    : [];

  const unassignedTeamsForRecruiter = isRecruiter
    ? allTeams.filter(team => !recruiterTeams.find(t => t.id === team.id))
    : [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Manage Assignments</h3>
            <p className="text-gray-600 mt-1">
              {user.name} ({user.user_code})
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {showTeams && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Team Assignments</h4>
                <div className="space-y-2">
                  {assignments.teams.map((team) => (
                    <div
                      key={team.id}
                      className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{team.name}</p>
                        <p className="text-xs text-gray-600 font-mono">{team.team_code}</p>
                      </div>
                      <button
                        onClick={() => handleUnassignTeam(team.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Unassign team"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {unassignedTeams.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm text-gray-600 mb-2">Assign new team:</p>
                      <div className="space-y-2">
                        {unassignedTeams.map((team) => (
                          <button
                            key={team.id}
                            onClick={() => handleAssignTeam(team.id)}
                            className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
                          >
                            <div>
                              <p className="font-medium text-gray-900">{team.name}</p>
                              <p className="text-xs text-gray-600 font-mono">{team.team_code}</p>
                            </div>
                            <Plus className="w-4 h-4 text-indigo-600" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {assignments.teams.length === 0 && unassignedTeams.length === 0 && (
                    <p className="text-gray-500 text-sm">No teams available</p>
                  )}
                </div>
              </div>
            )}

            {showClients && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Client Assignments</h4>
                <div className="space-y-2">
                  {assignments.clients.map((client) => (
                    <div
                      key={client.id}
                      className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{client.name}</p>
                        <p className="text-xs text-gray-600 font-mono">{client.client_code}</p>
                      </div>
                      <button
                        onClick={() => handleUnassignClient(client.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Unassign client"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {unassignedClients.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm text-gray-600 mb-2">Assign new client:</p>
                      <div className="space-y-2">
                        {unassignedClients.map((client) => (
                          <button
                            key={client.id}
                            onClick={() => handleAssignClient(client.id)}
                            className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
                          >
                            <div>
                              <p className="font-medium text-gray-900">{client.name}</p>
                              <p className="text-xs text-gray-600 font-mono">
                                {client.client_code}
                              </p>
                            </div>
                            <Plus className="w-4 h-4 text-indigo-600" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {assignments.clients.length === 0 && unassignedClients.length === 0 && (
                    <p className="text-gray-500 text-sm">No clients available</p>
                  )}
                </div>
              </div>
            )}

            {isRecruiter && (
              <div className="space-y-6">
                {/* Recruiter Team Assignments */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Team Assignments</h4>
                  <div className="space-y-2">
                    {recruiterTeams.map((team) => (
                      <div
                        key={team.id}
                        className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{team.name}</p>
                          <p className="text-xs text-gray-600 font-mono">{team.team_code}</p>
                        </div>
                        <button
                          onClick={() => handleUnassignRecruiterTeam(team.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Unassign team"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}

                    {unassignedTeamsForRecruiter.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm text-gray-600 mb-2">Assign new team:</p>
                        <div className="space-y-2">
                          {unassignedTeamsForRecruiter.map((team) => (
                            <button
                              key={team.id}
                              onClick={() => handleAssignRecruiterTeam(team.id)}
                              className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
                            >
                              <div>
                                <p className="font-medium text-gray-900">{team.name}</p>
                                <p className="text-xs text-gray-600 font-mono">{team.team_code}</p>
                              </div>
                              <Plus className="w-4 h-4 text-indigo-600" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {recruiterTeams.length === 0 && unassignedTeamsForRecruiter.length === 0 && (
                      <p className="text-gray-500 text-sm">No teams available</p>
                    )}
                  </div>
                </div>

                {/* Recruiter Client Assignments */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Client-Team Assignments</h4>
                  <div className="space-y-2">
                    {assignments.recruiter_clients?.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {assignment.client_name} - {assignment.team_name}
                          </p>
                          <p className="text-xs text-gray-600 font-mono">
                            {assignment.client_code} • {assignment.team_code}
                          </p>
                        </div>
                        <button
                          onClick={() => handleUnassignRecruiterClient(user.id, assignment.client_id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Unassign client"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}

                    {recruiterTeams.length > 0 && (
                      <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <p className="text-sm text-gray-600 mb-3">Assign new client-team pair:</p>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Select Team
                            </label>
                            <select
                              value={selectedTeam || ''}
                              onChange={(e) => setSelectedTeam(e.target.value ? parseInt(e.target.value) : null)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                            >
                              <option value="">Choose a team...</option>
                              {recruiterTeams.map((team) => (
                                <option key={team.id} value={team.id}>
                                  {team.name} ({team.team_code})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Select Client
                            </label>
                            <select
                              value={selectedClient || ''}
                              onChange={(e) => setSelectedClient(e.target.value ? parseInt(e.target.value) : null)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                            >
                              <option value="">Choose a client...</option>
                              {allClients.map((client) => (
                                <option key={client.id} value={client.id}>
                                  {client.name} ({client.client_code})
                                </option>
                              ))}
                            </select>
                          </div>
                          <button
                            onClick={handleAssignRecruiterClient}
                            disabled={!selectedTeam || !selectedClient}
                            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                          >
                            <Plus className="w-4 h-4 inline mr-1" />
                            Assign Client
                          </button>
                        </div>
                      </div>
                    )}

                    {(!assignments.recruiter_clients || assignments.recruiter_clients.length === 0) && (
                      <p className="text-gray-500 text-sm">
                        {recruiterTeams.length === 0 
                          ? "Assign a team first to add client assignments"
                          : "No client assignments yet"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!showTeams && !showClients && !isRecruiter && (
              <p className="text-gray-500 text-center py-8">
                This role does not have team or client assignments.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
