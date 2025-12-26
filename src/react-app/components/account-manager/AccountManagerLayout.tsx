import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { Building2, Users, RefreshCw, BarChart3, Briefcase, UserCircle, Target, LogOut, TrendingUp, AlertTriangle } from "lucide-react";
import { useAuth } from "@/react-app/hooks/useAuth";
import NotificationBell from "@/react-app/components/shared/NotificationBell";
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

interface AccountManagerLayoutProps {
  children: ReactNode;
  selectedClient: Client | null;
  selectedTeam: Team | null;
  onChangeClient: () => void;
  onChangeTeam: () => void;
  showChangeButtons: boolean;
}

export default function AccountManagerLayout({
  children,
  selectedClient,
  selectedTeam,
  onChangeClient,
  onChangeTeam,
  showChangeButtons,
}: AccountManagerLayoutProps) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [showCompanyPage, setShowCompanyPage] = useState(true);
  const [pendingDropoutsCount, setPendingDropoutsCount] = useState(0);

  useEffect(() => {
    fetchCompanySettings();
    fetchPendingDropouts();
  }, []);

  const fetchCompanySettings = async () => {
    try {
      const response = await fetchWithAuth('/api/company/settings');
      if (response.ok) {
        const data = await response.json();
        setShowCompanyPage(data.show_company_page);
      }
    } catch (error) {
      console.error('Failed to fetch company settings:', error);
    }
  };

  const fetchPendingDropouts = async () => {
    try {
      const response = await fetchWithAuth('/api/am/dropout-requests');
      if (response.ok) {
        const data = await response.json();
        setPendingDropoutsCount(data.length);
      }
    } catch (error) {
      console.error('Failed to fetch pending dropouts:', error);
    }
  };

  const navItems = [
    { path: "/am", icon: Target, label: "Dashboard" },
    { path: "/am/roles", icon: Briefcase, label: "Roles" },
    { path: "/am/analytics", icon: BarChart3, label: "Analytics" },
    { path: "/am/dropouts", icon: AlertTriangle, label: "Dropout Decisions" },
    { path: "/am/profile", icon: UserCircle, label: "Profile" },
  ];

  if (showCompanyPage) {
    navItems.splice(3, 0, { path: "/am/company", icon: TrendingUp, label: "Company" });
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-xl border-r border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg flex items-center justify-center">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">EBES</h1>
              <p className="text-sm text-slate-500">Account Manager</p>
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center text-white font-semibold text-sm">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.user_code}</p>
            </div>
          </div>
        </div>

        {/* Client and Team Selection */}
        {(selectedClient || selectedTeam) && (
          <div className="p-4 border-b border-slate-200 space-y-3">
            {selectedClient && (
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-medium text-slate-600">Client</span>
                  </div>
                  {showChangeButtons && (
                    <button
                      onClick={onChangeClient}
                      className="text-emerald-600 hover:text-emerald-700"
                      title="Change client"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-800">{selectedClient.name}</p>
                <p className="text-xs text-slate-500 font-mono">{selectedClient.client_code}</p>
              </div>
            )}

            {selectedTeam && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-medium text-slate-600">Team</span>
                  </div>
                  {showChangeButtons && (
                    <button
                      onClick={onChangeTeam}
                      className="text-blue-600 hover:text-blue-700"
                      title="Change team"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-800">{selectedTeam.name}</p>
                <p className="text-xs text-slate-500 font-mono">{selectedTeam.team_code}</p>
              </div>
            )}
          </div>
        )}
        
        <nav className="mt-6 px-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            const isDropoutTab = item.path === "/am/dropouts";
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex items-center justify-between px-4 py-3 rounded-lg mb-2 transition-all duration-200
                  ${isActive 
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg" 
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                  }
                `}
              >
                <div className="flex items-center space-x-3">
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </div>
                {isDropoutTab && pendingDropoutsCount > 0 && (
                  <span className="ml-auto px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] text-center">
                    {pendingDropoutsCount}
                  </span>
                )}
              </Link>
            );
          })}

          <div className="mt-8 pt-8 border-t border-slate-200">
            <button
              onClick={logout}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-all duration-200"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-800">
              {navItems.find(item => item.path === location.pathname)?.label || "Dashboard"}
            </h2>
            <div className="flex items-center space-x-4">
              <NotificationBell />
            </div>
          </div>
        </header>
        
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
