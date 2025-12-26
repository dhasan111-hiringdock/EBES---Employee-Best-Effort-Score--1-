import { useState, useEffect } from 'react';
import { Briefcase, Users, TrendingUp, Award, Target, CheckCircle, AlertCircle } from 'lucide-react';
import { fetchWithAuth } from '@/react-app/utils/api';
import ScoreTooltip from '@/react-app/components/shared/ScoreTooltip';
import { Link } from 'react-router';

interface EBESData {
  score: number;
  performance_label: string;
  total_submissions: number;
  total_interviews: number;
  total_deals: number;
  total_roles: number;
  active_roles: number;
}

interface QuickStats {
  total_teams: number;
  total_recruiters: number;
  total_active_roles: number;
  total_deals: number;
  total_interviews: number;
}

export default function RMDashboard() {
  const [ebesData, setEbesData] = useState<EBESData | null>(null);
  const [quickStats, setQuickStats] = useState<QuickStats | null>(null);
  const [pendingDropouts, setPendingDropouts] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Get current month EBES score
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      const ebesResponse = await fetchWithAuth(`/api/rm/ebes-score?start_date=${start}&end_date=${end}`);
      if (ebesResponse.ok) {
        const data = await ebesResponse.json();
        setEbesData(data);
      }

      // Get quick stats
      const statsResponse = await fetchWithAuth('/api/rm/analytics');
      if (statsResponse.ok) {
        const data = await statsResponse.json();
        setQuickStats({
          total_teams: data.total_teams,
          total_recruiters: data.total_recruiters,
          total_active_roles: data.total_active_roles,
          total_deals: data.total_deals,
          total_interviews: data.total_interviews,
        });
      }

      // Get pending dropouts
      const dropoutsResponse = await fetchWithAuth('/api/rm/dropout-requests');
      if (dropoutsResponse.ok) {
        const dropoutsData = await dropoutsResponse.json();
        setPendingDropouts(dropoutsData.length);
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setLoading(false);
    }
  };

  const getPerformanceColor = (label: string) => {
    switch (label) {
      case 'Excellent': return 'from-emerald-500 to-green-500';
      case 'Strong': return 'from-blue-500 to-indigo-500';
      case 'Average': return 'from-yellow-500 to-orange-500';
      case 'At Risk': return 'from-red-500 to-pink-500';
      default: return 'from-gray-500 to-slate-500';
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
      {/* Welcome Section */}
      <div>
        <h2 className="text-3xl font-bold text-slate-800">Dashboard</h2>
        <p className="text-slate-600 mt-1">Overview of your team's performance this month</p>
      </div>

      {/* Pending Dropouts Alert */}
      {pendingDropouts > 0 && (
        <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-lg">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-1">Dropout Acknowledgements Needed</h3>
                <p className="text-orange-100">You have {pendingDropouts} pending dropout {pendingDropouts === 1 ? 'request' : 'requests'} requiring your acknowledgement</p>
              </div>
            </div>
            <Link
              to="/rm/dropouts"
              className="px-6 py-3 bg-white text-orange-600 font-semibold rounded-lg hover:bg-orange-50 transition-colors shadow-lg"
            >
              Review Now
            </Link>
          </div>
        </div>
      )}

      {/* EBES Score Highlight */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl shadow-xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-2xl font-bold mb-2">Your EBES Score</h3>
            <p className="text-indigo-100 mb-6">Employee Best Effort Score - Current Month</p>
            <ScoreTooltip 
              type="ebes" 
              score={ebesData?.score || 0} 
              label={ebesData?.performance_label || 'No Data'}
              className="text-white mb-4"
            />
            <div className={`inline-block px-6 py-3 rounded-lg bg-gradient-to-r ${getPerformanceColor(ebesData?.performance_label || 'Average')} text-white font-semibold text-lg shadow-lg`}>
              {ebesData?.performance_label || 'No Data'}
            </div>
          </div>
          <div className="w-40 h-40 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
            <Target className="w-20 h-20 text-white" />
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <span className="text-sm font-medium text-slate-600">Teams</span>
          </div>
          <p className="text-4xl font-bold text-slate-800">{quickStats?.total_teams || 0}</p>
          <p className="text-sm text-slate-500 mt-2">Under your management</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <span className="text-sm font-medium text-slate-600">Recruiters</span>
          </div>
          <p className="text-4xl font-bold text-slate-800">{quickStats?.total_recruiters || 0}</p>
          <p className="text-sm text-slate-500 mt-2">Active team members</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <span className="text-sm font-medium text-slate-600">Active Roles</span>
          </div>
          <p className="text-4xl font-bold text-slate-800">{quickStats?.total_active_roles || 0}</p>
          <p className="text-sm text-slate-500 mt-2">Currently being worked</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <span className="text-sm font-medium text-slate-600">Interviews</span>
          </div>
          <p className="text-4xl font-bold text-slate-800">{quickStats?.total_interviews || 0}</p>
          <p className="text-sm text-slate-500 mt-2">This month</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center">
              <Award className="w-6 h-6 text-white" />
            </div>
            <span className="text-sm font-medium text-slate-600">Deals Closed</span>
          </div>
          <p className="text-4xl font-bold text-slate-800">{quickStats?.total_deals || 0}</p>
          <p className="text-sm text-slate-500 mt-2">This month</p>
        </div>
      </div>

      {/* Call to Action - Analytics */}
      <div className="bg-gradient-to-r from-slate-50 to-blue-50 border-2 border-indigo-200 rounded-2xl p-8">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">Need Deeper Insights?</h3>
            <p className="text-slate-600 mb-4">
              Access detailed performance analytics, identify underperformers, and get AI-powered corrective action suggestions.
            </p>
            <Link
              to="/rm/analytics"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg"
            >
              <TrendingUp className="w-5 h-5" />
              View Advanced Analytics
            </Link>
          </div>
          <div className="hidden lg:block">
            <svg className="w-32 h-32 text-indigo-200" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 13h2v8H3v-8zm4-4h2v12H7V9zm4-6h2v18h-2V3zm4 8h2v10h-2V11zm4-2h2v12h-2V9z"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
