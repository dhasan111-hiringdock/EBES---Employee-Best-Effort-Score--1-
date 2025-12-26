import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { Users, Building2, UsersRound, BarChart3, LogOut, TrendingUp, Settings } from "lucide-react";
import { useAuth } from "@/react-app/hooks/useAuth";
import NotificationBell from "@/react-app/components/shared/NotificationBell";
import { fetchWithAuth } from "@/react-app/utils/api";

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();
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

  const menuItems = [
    { path: "/admin/users", label: "Users", icon: Users },
    { path: "/admin/clients", label: "Clients", icon: Building2 },
    { path: "/admin/teams", label: "Teams", icon: UsersRound },
    { path: "/admin/performance", label: "Performance", icon: BarChart3 },
    { path: "/admin/settings", label: "Settings", icon: Settings },
  ];

  // Add Company Page if enabled
  if (showCompanyPage) {
    menuItems.splice(4, 0, { path: "/admin/company", label: "Company", icon: TrendingUp });
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Sidebar */}
      <div className="w-64 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 shadow-2xl flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-2xl font-bold text-white">EBES Admin</h1>
          <p className="text-slate-400 text-sm mt-1">Dashboard</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-slate-700">
          <div className="mb-3">
            <p className="text-white font-medium text-sm">{user?.name}</p>
            <p className="text-slate-400 text-xs">{user?.email}</p>
            <p className="text-indigo-400 text-xs mt-1 font-mono">{user?.user_code}</p>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {/* Top Bar with Notification Bell */}
        <div className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-end shadow-sm">
          <NotificationBell />
        </div>
        <div className="max-w-7xl mx-auto p-8">{children}</div>
      </div>
    </div>
  );
}
