import { useState, useEffect } from "react";
import { UserCircle, Mail, Award, Building2, Users } from "lucide-react";
import { useAuth } from "@/react-app/hooks/useAuth";
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

export default function RMProfile() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      const [clientsRes, teamsRes] = await Promise.all([
        fetchWithAuth("/api/rm/clients"),
        fetchWithAuth("/api/rm/teams")
      ]);

      if (clientsRes.ok) {
        const clientsData = await clientsRes.json();
        setClients(clientsData);
      }

      if (teamsRes.ok) {
        const teamsData = await teamsRes.json();
        setTeams(teamsData);
      }
    } catch (error) {
      console.error("Failed to fetch assignments:", error);
    } finally {
      setLoading(false);
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
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Profile</h2>
        <p className="text-gray-600 mt-1">Your account information and assignments</p>
      </div>

      {/* Profile Card */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-2xl p-8 text-white">
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
            <UserCircle className="w-16 h-16 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-3xl font-bold mb-2">{user?.name}</h3>
            <div className="flex items-center gap-2 text-white/80 mb-1">
              <Mail className="w-4 h-4" />
              <span>{user?.email}</span>
            </div>
            <div className="flex items-center gap-2 text-white/80">
              <Award className="w-4 h-4" />
              <span className="font-mono">{user?.user_code}</span>
            </div>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-white/20">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-white/80 text-sm mb-1">Role</p>
              <p className="text-xl font-bold">Recruitment Manager</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-white/80 text-sm mb-1">Status</p>
              <p className="text-xl font-bold">Active</p>
            </div>
          </div>
        </div>
      </div>

      {/* Assignments */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Clients */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Building2 className="w-6 h-6 text-indigo-600" />
            <h3 className="text-xl font-bold text-gray-900">Assigned Clients</h3>
          </div>
          <div className="space-y-3">
            {clients.length > 0 ? (
              clients.map((client) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div>
                    <p className="font-semibold text-gray-900">{client.name}</p>
                    <p className="text-xs text-gray-500 font-mono">{client.client_code}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm">No clients assigned</p>
            )}
          </div>
        </div>

        {/* Teams */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-6 h-6 text-indigo-600" />
            <h3 className="text-xl font-bold text-gray-900">Assigned Teams</h3>
          </div>
          <div className="space-y-3">
            {teams.length > 0 ? (
              teams.map((team) => (
                <div
                  key={team.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div>
                    <p className="font-semibold text-gray-900">{team.name}</p>
                    <p className="text-xs text-gray-500 font-mono">{team.team_code}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm">No teams assigned</p>
            )}
          </div>
        </div>
      </div>

      {/* Account Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Award className="w-6 h-6 text-gray-600" />
          <h3 className="text-xl font-bold text-gray-900">Account Information</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">User ID</p>
            <p className="font-semibold text-gray-900">{user?.id}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">User Code</p>
            <p className="font-mono font-semibold text-gray-900">{user?.user_code}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Clients Managed</p>
            <p className="font-semibold text-gray-900">{clients.length}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Teams Managed</p>
            <p className="font-semibold text-gray-900">{teams.length}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
