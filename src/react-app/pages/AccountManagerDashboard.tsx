import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router";
import AccountManagerLayout from "@/react-app/components/account-manager/AccountManagerLayout";
import RoleManagement from "@/react-app/components/account-manager/RoleManagement";
import AMAnalytics from "@/react-app/components/account-manager/AMAnalytics";
import AMDashboard from "@/react-app/components/account-manager/AMDashboard";
import Profile from "@/react-app/components/account-manager/Profile";
import CompanyPage from "@/react-app/pages/CompanyPage";
import MonthlyReminderModal from "@/react-app/components/account-manager/MonthlyReminderModal";
import DropoutDecisions from "@/react-app/components/account-manager/DropoutDecisions";
import ClientTeamSelector from "@/react-app/components/account-manager/ClientTeamSelector";
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

export default function AccountManagerDashboard() {
  const [clients, setClients] = useState<Client[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReminder, setShowReminder] = useState(false);

  useEffect(() => {
    fetchAssignments();
    checkReminderStatus();
  }, []);

  const fetchAssignments = async () => {
    try {
      const response = await fetchWithAuth("/api/am/assignments");
      if (response.ok) {
        const data = await response.json();
        setClients(data.clients);
        setTeams(data.teams);

        // Auto-select if only one client/team
        if (data.clients.length === 1) {
          setSelectedClient(data.clients[0]);
        }
        if (data.teams.length === 1) {
          setSelectedTeam(data.teams[0]);
        }
      }
    } catch (error) {
      console.error("Failed to fetch assignments:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkReminderStatus = async () => {
    try {
      const response = await fetchWithAuth("/api/am/reminder-status");
      if (response.ok) {
        const data = await response.json();
        setShowReminder(data.shouldShow);
      }
    } catch (error) {
      console.error("Failed to check reminder status:", error);
    }
  };

  const handleReminderConfirm = async () => {
    try {
      const response = await fetchWithAuth("/api/am/confirm-reminder", {
        method: "POST",
      });
      if (response.ok) {
        setShowReminder(false);
      }
    } catch (error) {
      console.error("Failed to confirm reminder:", error);
    }
  };

  const handleReminderSkip = () => {
    setShowReminder(false);
  };

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

  return (
    <>
      <AccountManagerLayout
        selectedClient={selectedClient}
        selectedTeam={selectedTeam}
        onChangeClient={() => setSelectedClient(null)}
        onChangeTeam={() => setSelectedTeam(null)}
        showChangeButtons={clients.length > 1 || teams.length > 1}
      >
        {needsSelection ? (
          <ClientTeamSelector
            clients={clients}
            teams={teams}
            selectedClient={selectedClient}
            selectedTeam={selectedTeam}
            onSelectClient={setSelectedClient}
            onSelectTeam={setSelectedTeam}
          />
        ) : (
          <Routes>
            <Route path="/" element={<AMDashboard />} />
            <Route
              path="/roles"
              element={
                <RoleManagement
                  clientId={selectedClient!.id}
                  teamId={selectedTeam!.id}
                />
              }
            />
            <Route path="/analytics" element={<AMAnalytics />} />
            <Route path="/dropouts" element={<DropoutDecisions />} />
            <Route path="/company" element={<CompanyPage />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/am" replace />} />
          </Routes>
        )}
      </AccountManagerLayout>

      {showReminder && (
        <MonthlyReminderModal
          onConfirm={handleReminderConfirm}
          onSkip={handleReminderSkip}
        />
      )}
    </>
  );
}
