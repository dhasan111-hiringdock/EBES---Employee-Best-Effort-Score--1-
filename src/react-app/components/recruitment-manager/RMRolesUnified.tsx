import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/react-app/utils/api";
import ClientTeamSelector from "@/react-app/components/account-manager/ClientTeamSelector";
import RoleManagement from "@/react-app/components/account-manager/RoleManagement";
 

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

export default function RMRolesUnified() {
  const [clients, setClients] = useState<Client[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        const res = await fetchWithAuth("/api/rm/assignments");
        if (!res.ok) return;
        const data = await res.json();
        setClients(data.clients || []);
        setTeams(data.teams || []);
        if ((data.clients || []).length === 1) setSelectedClient(data.clients[0]);
        if ((data.teams || []).length === 1) setSelectedTeam(data.teams[0]);
      } finally {
        setLoading(false);
      }
    };
    fetchAssignments();
  }, []);

  const needsSelection =
    (clients.length > 1 && !selectedClient) ||
    (teams.length > 1 && !selectedTeam);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (clients.length === 0 || teams.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center space-y-4">
          <div className="text-yellow-500 text-5xl">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900">No Assignments</h2>
          <p className="text-gray-600">
            You have not been assigned any clients or teams yet. Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return needsSelection ? (
    <ClientTeamSelector
      clients={clients}
      teams={teams}
      selectedClient={selectedClient}
      selectedTeam={selectedTeam}
      onSelectClient={setSelectedClient as any}
      onSelectTeam={setSelectedTeam as any}
    />
  ) : (
    <div className="p-4">
      <RoleManagement
        clientId={selectedClient!.id}
        teamId={selectedTeam!.id}
        mode="rm"
        allowedActions={{
          create: false,
          edit: false,
          delete: false,
          changeStatus: false,
          addInterview: false,
          submissionsActions: false,
          saveNotes: false,
        }}
      />
    </div>
  );
}
