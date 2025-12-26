import { useEffect, useState } from 'react';
import { Building2, Users, Briefcase } from 'lucide-react';
import { fetchWithAuth } from '@/react-app/utils/api';

interface DashboardStats {
  total_companies: number;
  total_admins: number;
  total_users: number;
  active_roles: number;
}

export default function SuperAdminHome() {
  const [stats, setStats] = useState<DashboardStats>({
    total_companies: 0,
    total_admins: 0,
    total_users: 0,
    active_roles: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await fetchWithAuth('/api/super-admin/dashboard-stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Companies',
      value: stats.total_companies,
      icon: Building2,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'from-blue-50 to-cyan-50',
    },
    {
      title: 'Total Admins',
      value: stats.total_admins,
      icon: Users,
      color: 'from-purple-500 to-pink-500',
      bgColor: 'from-purple-50 to-pink-50',
    },
    {
      title: 'Total Users',
      value: stats.total_users,
      icon: Users,
      color: 'from-green-500 to-emerald-500',
      bgColor: 'from-green-50 to-emerald-50',
    },
    {
      title: 'Active Roles',
      value: stats.active_roles,
      icon: Briefcase,
      color: 'from-orange-500 to-amber-500',
      bgColor: 'from-orange-50 to-amber-50',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Super Admin Dashboard</h1>
        <p className="text-slate-600">Manage companies and users across the platform</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <div
            key={stat.title}
            className={`bg-gradient-to-br ${stat.bgColor} rounded-2xl p-6 border border-slate-200 shadow-lg hover:shadow-xl transition-all`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center shadow-md`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">{stat.title}</p>
              <p className="text-3xl font-bold text-slate-800">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl p-8 shadow-lg border border-slate-200">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href="/super-admin/companies"
            className="flex items-center gap-3 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl hover:from-indigo-100 hover:to-purple-100 transition-all border border-indigo-200"
          >
            <Building2 className="w-6 h-6 text-indigo-600" />
            <div>
              <p className="font-semibold text-slate-800">Manage Companies</p>
              <p className="text-sm text-slate-600">Create and manage companies</p>
            </div>
          </a>
          <a
            href="/super-admin/users"
            className="flex items-center gap-3 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl hover:from-purple-100 hover:to-pink-100 transition-all border border-purple-200"
          >
            <Users className="w-6 h-6 text-purple-600" />
            <div>
              <p className="font-semibold text-slate-800">View All Users</p>
              <p className="text-sm text-slate-600">Monitor user activity</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
