import { Building2, Users } from "lucide-react";

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

interface ClientTeamSelectorProps {
  clients: Client[];
  teams: Team[];
  selectedClient: Client | null;
  selectedTeam: Team | null;
  onSelectClient: (client: Client) => void;
  onSelectTeam: (team: Team) => void;
}

export default function ClientTeamSelector({
  clients,
  teams,
  selectedClient,
  selectedTeam,
  onSelectClient,
  onSelectTeam,
}: ClientTeamSelectorProps) {
  const needsClient = clients.length > 1 && !selectedClient;
  const needsTeam = teams.length > 1 && !selectedTeam;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Select Your Assignment</h2>
        <p className="text-gray-600 mb-8">
          Please select a client and team to continue managing roles
        </p>

        <div className="space-y-8">
          {needsClient && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-green-600" />
                Select Client
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {clients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => onSelectClient(client)}
                    className="p-4 border-2 border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all text-left group"
                  >
                    <p className="font-semibold text-gray-900 group-hover:text-green-700">
                      {client.name}
                    </p>
                    <p className="text-sm text-gray-600 font-mono mt-1">{client.client_code}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!needsClient && selectedClient && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
              <p className="text-sm text-green-700 font-medium">Selected Client:</p>
              <p className="text-lg font-bold text-gray-900">{selectedClient.name}</p>
            </div>
          )}

          {needsTeam && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Select Team
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teams.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => onSelectTeam(team)}
                    className="p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
                  >
                    <p className="font-semibold text-gray-900 group-hover:text-blue-700">
                      {team.name}
                    </p>
                    <p className="text-sm text-gray-600 font-mono mt-1">{team.team_code}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!needsTeam && selectedTeam && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-sm text-blue-700 font-medium">Selected Team:</p>
              <p className="text-lg font-bold text-gray-900">{selectedTeam.name}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
