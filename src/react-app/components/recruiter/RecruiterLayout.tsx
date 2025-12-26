import { NavLink } from "react-router";
import { LayoutDashboard, BarChart3, UserCircle, LogOut, Building2, TrendingUp, Users, Briefcase } from "lucide-react";
import { useAuth } from "@/react-app/hooks/useAuth";
import { useEffect, useState } from "react";
import NotificationBell from "@/react-app/components/shared/NotificationBell";
import { fetchWithAuth } from "@/react-app/utils/api";

interface RecruiterLayoutProps {
  children: React.ReactNode;
  selectedClient?: any;
  onClientChange?: (client: any) => void;
}

export default function RecruiterLayout({ children, selectedClient, onClientChange }: RecruiterLayoutProps) {
  const { user, logout } = useAuth();
  const [showCompanyPage, setShowCompanyPage] = useState(true);

  useEffect(() => {
    fetchCompanySettings();
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

  const navItems = [
    { to: "/recruiter", icon: LayoutDashboard, label: "Dashboard", end: true },
    { to: "/recruiter/analytics", icon: BarChart3, label: "Analytics", end: false },
    { to: "/recruiter/candidates", icon: Users, label: "Candidates", end: false },
    { to: "/recruiter/roles", icon: Briefcase, label: "Roles", end: false },
    { to: "/recruiter/profile", icon: UserCircle, label: "Profile", end: false },
  ];

  if (showCompanyPage) {
    navItems.splice(4, 0, { to: "/recruiter/company", icon: TrendingUp, label: "Company", end: false });
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 shadow-lg flex flex-col">
        {/* Logo/Header */}
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">EBES</h1>
              <p className="text-xs text-slate-500">Recruiter</p>
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center text-white font-semibold text-sm">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.user_code}</p>
            </div>
          </div>
        </div>

        {/* Selected Client */}
        {selectedClient && (
          <div className="px-4 py-3 border-b border-slate-200">
            <div className="flex items-start gap-2">
              <Building2 className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-500 mb-0.5">Client</p>
                <p className="text-sm font-semibold text-slate-800 truncate">{selectedClient.name}</p>
                <p className="text-xs text-slate-500 font-mono">{selectedClient.client_code}</p>
                {selectedClient.team_name && (
                  <p className="text-xs text-slate-500 mt-1">Team: {selectedClient.team_name}</p>
                )}
              </div>
            </div>
            {onClientChange && (
              <button
                onClick={() => onClientChange(null)}
                className="mt-2 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Change Client
              </button>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 overflow-y-auto">
          <div className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg"
                      : "text-slate-600 hover:bg-slate-100"
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-slate-200">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 font-medium"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Top Bar with Notification Bell */}
        <div className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-end shadow-sm">
          <NotificationBell />
        </div>
        <div className="max-w-7xl mx-auto px-8 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
