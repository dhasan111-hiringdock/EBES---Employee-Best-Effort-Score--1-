import { useState, useEffect } from 'react';
import { 
  Building2, Users, Briefcase, Target, TrendingUp, Award,
  Trophy, Star, Zap, TrendingDown, Filter, Search, Mail, Calendar,
  UsersRound, BarChart3
} from 'lucide-react';
import { fetchWithAuth } from '@/react-app/utils/api';

interface CompanyData {
  overview: {
    total_teams: number;
    total_clients: number;
    total_recruiters: number;
    total_account_managers: number;
    total_recruitment_managers: number;
    total_active_roles: number;
    total_non_active_roles: number;
    total_interviews: number;
    total_deals: number;
    total_submissions: number;
    total_dropouts: number;
  };
  topPerformers: {
    recruiters: Array<{
      name: string;
      user_code: string;
      deals: number;
      submissions: number;
      score: number;
    }>;
    account_managers: Array<{
      name: string;
      user_code: string;
      active_roles: number;
      total_roles: number;
      score: number;
    }>;
    recruitment_managers: Array<{
      name: string;
      user_code: string;
      teams_managed: number;
      score: number;
    }>;
  };
}

interface Employee {
  id: number;
  name: string;
  email: string;
  user_code: string;
  role: string;
  created_at: string;
  teams?: Array<{ id: number; name: string; team_code: string }>;
  clients?: Array<{ id: number; name: string; client_code: string }>;
  stats?: any;
}

export default function CompanyPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'employees'>('overview');
  const [data, setData] = useState<CompanyData | null>(null);
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [allClients, setAllClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Employee tab state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeSettings, setEmployeeSettings] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // Filters
  const [dateRange, setDateRange] = useState('this_month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (activeTab === 'overview') {
      Promise.all([
        fetchFilterOptions(),
        fetchData()
      ]);
    } else {
      fetchEmployeeProfiles();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'overview') {
      fetchData();
    }
  }, [dateRange, customStartDate, customEndDate, selectedTeam, selectedClient]);

  useEffect(() => {
    if (activeTab === 'employees') {
      fetchEmployeeProfiles();
    }
  }, [searchQuery, roleFilter]);

  const fetchFilterOptions = async () => {
    try {
      const [teamsRes, clientsRes] = await Promise.all([
        fetchWithAuth('/api/company/filter-teams'),
        fetchWithAuth('/api/company/filter-clients')
      ]);

      if (teamsRes.ok) setAllTeams(await teamsRes.json());
      if (clientsRes.ok) setAllClients(await clientsRes.json());
    } catch (error) {
      console.error('Failed to fetch filter options:', error);
    }
  };

  const fetchEmployeeProfiles = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (roleFilter !== "all") params.append("role", roleFilter);

      const response = await fetchWithAuth(`/api/employees/profiles?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.profiles);
        setEmployeeSettings(data.settings);
      }
    } catch (error) {
      console.error("Failed to fetch employee profiles:", error);
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = () => {
    const now = new Date();
    let start = '';
    let end = '';

    if (dateRange === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    } else if (dateRange === 'last_month') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      start = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1).toISOString().split('T')[0];
      end = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).toISOString().split('T')[0];
    } else if (dateRange === 'custom') {
      start = customStartDate;
      end = customEndDate;
    }

    return { start, end };
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      const { start, end } = getDateRange();
      const params = new URLSearchParams();
      
      if (start && end) {
        params.append('start_date', start);
        params.append('end_date', end);
      }
      if (selectedTeam) params.append('team_id', selectedTeam);
      if (selectedClient) params.append('client_id', selectedClient);

      const response = await fetchWithAuth(`/api/company/data?${params.toString()}`);
      if (response.ok) {
        const companyData = await response.json();
        setData(companyData);
      }
    } catch (error) {
      console.error('Failed to fetch company data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "recruiter": return Target;
      case "account_manager": return BarChart3;
      case "recruitment_manager": return Users;
      default: return Briefcase;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "recruiter": return "from-blue-500 to-indigo-500";
      case "account_manager": return "from-emerald-500 to-teal-500";
      case "recruitment_manager": return "from-purple-500 to-pink-500";
      default: return "from-gray-500 to-slate-500";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "recruiter": return "Recruiter";
      case "account_manager": return "Account Manager";
      case "recruitment_manager": return "Recruitment Manager";
      default: return role;
    }
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 80) return "text-green-600 bg-green-100";
    if (score >= 60) return "text-blue-600 bg-blue-100";
    if (score >= 40) return "text-yellow-600 bg-yellow-100";
    return "text-red-600 bg-red-100";
  };

  if (loading && activeTab === 'overview') {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600 mb-4"></div>
        <p className="text-slate-600 font-medium">Loading company overview...</p>
      </div>
    );
  }

  const conversionRate = data && data.overview.total_interviews > 0 
    ? (data.overview.total_deals / data.overview.total_interviews * 100).toFixed(1)
    : '0.0';

  const dropoutRate = data && data.overview.total_deals > 0
    ? (data.overview.total_dropouts / (data.overview.total_deals + data.overview.total_dropouts) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div>
        <h2 className="text-3xl font-bold text-slate-800 mb-1">Company Overview</h2>
        <p className="text-slate-500 mb-6">Real-time performance metrics across the organization</p>
        
        {/* Tab Navigation */}
        <div className="flex gap-2 border-b-2 border-slate-200">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-3 font-semibold transition-all relative ${
              activeTab === 'overview'
                ? 'text-indigo-600 border-b-2 border-indigo-600 -mb-0.5'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              <span>Overview & Leaderboards</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('employees')}
            className={`px-6 py-3 font-semibold transition-all relative ${
              activeTab === 'employees'
                ? 'text-indigo-600 border-b-2 border-indigo-600 -mb-0.5'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              <span>Employee Profiles</span>
            </div>
          </button>
        </div>
      </div>

      {/* Overview Tab Content */}
      {activeTab === 'overview' && data && (
        <>
          {/* Filters Toggle */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all font-medium shadow-lg"
            >
              <Filter className="w-4 h-4" />
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 animate-in slide-in-from-top duration-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Date Range</label>
                  <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="this_month">This Month</option>
                    <option value="last_month">Last Month</option>
                    <option value="custom">Custom Range</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Team</label>
                  <select
                    value={selectedTeam}
                    onChange={(e) => setSelectedTeam(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">All Teams</option>
                    {allTeams.map((team: any) => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Client</label>
                  <select
                    value={selectedClient}
                    onChange={(e) => setSelectedClient(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">All Clients</option>
                    {allClients.map((client: any) => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </div>

                {dateRange === 'custom' && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Custom Date Range</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-5 text-white shadow-lg hover:shadow-xl transition-all">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-6 h-6" />
                <p className="text-sm font-medium opacity-90">Teams</p>
              </div>
              <p className="text-4xl font-bold">{data.overview.total_teams}</p>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl p-5 text-white shadow-lg hover:shadow-xl transition-all">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-6 h-6" />
                <p className="text-sm font-medium opacity-90">Clients</p>
              </div>
              <p className="text-4xl font-bold">{data.overview.total_clients}</p>
            </div>

            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-5 text-white shadow-lg hover:shadow-xl transition-all">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-6 h-6" />
                <p className="text-sm font-medium opacity-90">Recruiters</p>
              </div>
              <p className="text-4xl font-bold">{data.overview.total_recruiters}</p>
            </div>

            <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-5 text-white shadow-lg hover:shadow-xl transition-all">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-6 h-6" />
                <p className="text-sm font-medium opacity-90">AMs</p>
              </div>
              <p className="text-4xl font-bold">{data.overview.total_account_managers}</p>
            </div>

            <div className="bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl p-5 text-white shadow-lg hover:shadow-xl transition-all">
              <div className="flex items-center gap-2 mb-3">
                <Award className="w-6 h-6" />
                <p className="text-sm font-medium opacity-90">RMs</p>
              </div>
              <p className="text-4xl font-bold">{data.overview.total_recruitment_managers}</p>
            </div>

            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-5 text-white shadow-lg hover:shadow-xl transition-all">
              <div className="flex items-center gap-2 mb-3">
                <Briefcase className="w-6 h-6" />
                <p className="text-sm font-medium opacity-90">Active Roles</p>
              </div>
              <p className="text-4xl font-bold">{data.overview.total_active_roles}</p>
            </div>
          </div>

          {/* Performance Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-md border-2 border-blue-200 p-5 hover:shadow-lg transition-all">
              <div className="flex items-center justify-between mb-2">
                <Target className="w-8 h-8 text-blue-600" />
                <div className="text-right">
                  <p className="text-3xl font-bold text-blue-600">{data.overview.total_submissions}</p>
                  <p className="text-xs text-slate-500 mt-1">Submissions</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md border-2 border-purple-200 p-5 hover:shadow-lg transition-all">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-8 h-8 text-purple-600" />
                <div className="text-right">
                  <p className="text-3xl font-bold text-purple-600">{data.overview.total_interviews}</p>
                  <p className="text-xs text-slate-500 mt-1">Interviews</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md border-2 border-emerald-200 p-5 hover:shadow-lg transition-all">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-8 h-8 text-emerald-600" />
                <div className="text-right">
                  <p className="text-3xl font-bold text-emerald-600">{data.overview.total_deals}</p>
                  <p className="text-xs text-slate-500 mt-1">Deals Closed</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md border-2 border-red-200 p-5 hover:shadow-lg transition-all">
              <div className="flex items-center justify-between mb-2">
                <TrendingDown className="w-8 h-8 text-red-600" />
                <div className="text-right">
                  <p className="text-3xl font-bold text-red-600">{data.overview.total_dropouts}</p>
                  <p className="text-xs text-slate-500 mt-1">Dropouts</p>
                </div>
              </div>
            </div>
          </div>

          {/* Conversion Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-emerald-800">Conversion Rate</h3>
                  <p className="text-sm text-emerald-600">Interviews to Deals</p>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-5xl font-bold text-emerald-700">{conversionRate}%</p>
                <p className="text-sm text-emerald-600">success rate</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-pink-50 border-2 border-red-300 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center">
                  <TrendingDown className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-red-800">Dropout Rate</h3>
                  <p className="text-sm text-red-600">Candidates Lost</p>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-5xl font-bold text-red-700">{dropoutRate}%</p>
                <p className="text-sm text-red-600">attrition</p>
              </div>
            </div>
          </div>

          {/* Top Performers Leaderboards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Recruiters */}
            <div className="bg-white rounded-2xl shadow-xl border-2 border-emerald-200 overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-5">
                <div className="flex items-center gap-3">
                  <Trophy className="w-7 h-7 text-yellow-300" />
                  <div>
                    <h3 className="text-xl font-bold text-white">Top Recruiters</h3>
                    <p className="text-sm text-emerald-100">Based on deals closed</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                {data.topPerformers.recruiters.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">No data available</p>
                ) : (
                  <div className="space-y-3">
                    {data.topPerformers.recruiters.map((recruiter, index) => (
                      <div key={index} className="flex items-center gap-3 p-4 bg-gradient-to-r from-slate-50 to-emerald-50 rounded-xl hover:shadow-md transition-all border border-emerald-100">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                          index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-yellow-900 shadow-lg' :
                          index === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-slate-700 shadow-md' :
                          index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white shadow-md' :
                          'bg-slate-200 text-slate-600'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-slate-800">{recruiter.name}</p>
                          <p className="text-xs text-slate-500 font-mono">{recruiter.user_code}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-emerald-600">{recruiter.deals}</p>
                          <p className="text-xs text-slate-500">deals</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Top Account Managers */}
            <div className="bg-white rounded-2xl shadow-xl border-2 border-indigo-200 overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-6 py-5">
                <div className="flex items-center gap-3">
                  <Trophy className="w-7 h-7 text-yellow-300" />
                  <div>
                    <h3 className="text-xl font-bold text-white">Top Account Managers</h3>
                    <p className="text-sm text-indigo-100">Based on active roles</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                {data.topPerformers.account_managers.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">No data available</p>
                ) : (
                  <div className="space-y-3">
                    {data.topPerformers.account_managers.map((am, index) => (
                      <div key={index} className="flex items-center gap-3 p-4 bg-gradient-to-r from-slate-50 to-indigo-50 rounded-xl hover:shadow-md transition-all border border-indigo-100">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                          index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-yellow-900 shadow-lg' :
                          index === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-slate-700 shadow-md' :
                          index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white shadow-md' :
                          'bg-slate-200 text-slate-600'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-slate-800">{am.name}</p>
                          <p className="text-xs text-slate-500 font-mono">{am.user_code}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-indigo-600">{am.active_roles}</p>
                          <p className="text-xs text-slate-500">active roles</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Top Recruitment Managers */}
            <div className="bg-white rounded-2xl shadow-xl border-2 border-blue-200 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-5">
                <div className="flex items-center gap-3">
                  <Trophy className="w-7 h-7 text-yellow-300" />
                  <div>
                    <h3 className="text-xl font-bold text-white">Top Recruitment Managers</h3>
                    <p className="text-sm text-blue-100">Based on teams managed</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                {data.topPerformers.recruitment_managers.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">No data available</p>
                ) : (
                  <div className="space-y-3">
                    {data.topPerformers.recruitment_managers.map((rm, index) => (
                      <div key={index} className="flex items-center gap-3 p-4 bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl hover:shadow-md transition-all border border-blue-100">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                          index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-yellow-900 shadow-lg' :
                          index === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-slate-700 shadow-md' :
                          index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white shadow-md' :
                          'bg-slate-200 text-slate-600'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-slate-800">{rm.name}</p>
                          <p className="text-xs text-slate-500 font-mono">{rm.user_code}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-blue-600">{rm.teams_managed}</p>
                          <p className="text-xs text-slate-500">teams</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Employees Tab Content */}
      {activeTab === 'employees' && (
        <>
          {!employeeSettings?.show_employee_profiles ? (
            <div className="bg-white rounded-2xl shadow-2xl border-2 border-slate-200 p-12 max-w-md mx-auto text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="w-8 h-8 text-gray-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-3">Employee Profiles Disabled</h2>
              <p className="text-slate-600">
                Employee profiles are currently disabled by the administrator.
              </p>
            </div>
          ) : (
            <>
              {/* Employee Search and Filters */}
              <div className="bg-white rounded-2xl shadow-lg border-2 border-slate-200 p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search by name, email, or code..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    />
                  </div>

                  {/* Role Filter */}
                  <div>
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    >
                      <option value="all">All Roles</option>
                      <option value="recruiter">Recruiters</option>
                      <option value="account_manager">Account Managers</option>
                      <option value="recruitment_manager">Recruitment Managers</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                  <Users className="w-4 h-4" />
                  <span>{employees.length} employee{employees.length !== 1 ? 's' : ''} found</span>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
              ) : (
                <>
                  {/* Employee Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {employees.map((employee) => {
                      const RoleIcon = getRoleIcon(employee.role);
                      const hasStats = employee.stats && (
                        (employee.role === 'recruiter' && employeeSettings.show_recruiter_stats) ||
                        (employee.role === 'account_manager' && employeeSettings.show_am_stats) ||
                        (employee.role === 'recruitment_manager' && employeeSettings.show_rm_stats)
                      );

                      return (
                        <div
                          key={employee.id}
                          className="bg-white rounded-2xl shadow-lg border-2 border-slate-200 overflow-hidden hover:shadow-xl transition-all duration-300 group"
                        >
                          {/* Header with Role Color */}
                          <div className={`h-24 bg-gradient-to-r ${getRoleColor(employee.role)} relative`}>
                            <div className="absolute bottom-0 left-6 transform translate-y-1/2">
                              <div className="w-20 h-20 bg-white rounded-2xl shadow-lg flex items-center justify-center border-4 border-white">
                                <RoleIcon className="w-10 h-10 text-slate-700" />
                              </div>
                            </div>
                          </div>

                          {/* Content */}
                          <div className="pt-12 px-6 pb-6">
                            {/* Name and Code */}
                            <div className="mb-4">
                              <h3 className="text-xl font-bold text-slate-800 mb-1">{employee.name}</h3>
                              <p className="text-sm font-mono text-slate-500 mb-2">{employee.user_code}</p>
                              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${getRoleColor(employee.role)} text-white`}>
                                {getRoleLabel(employee.role)}
                              </span>
                            </div>

                            {/* Contact */}
                            <div className="space-y-2 mb-4">
                              <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Mail className="w-4 h-4 text-slate-400" />
                                <span className="truncate">{employee.email}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Calendar className="w-4 h-4 text-slate-400" />
                                <span>Joined {new Date(employee.created_at).toLocaleDateString()}</span>
                              </div>
                            </div>

                            {/* Teams & Clients */}
                            {employeeSettings.show_team_stats && employee.teams && employee.teams.length > 0 && (
                              <div className="mb-4">
                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-2">
                                  <UsersRound className="w-4 h-4" />
                                  <span>Teams</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {employee.teams.map((team) => (
                                    <span key={team.id} className="px-2 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-medium">
                                      {team.team_code}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {employeeSettings.show_client_stats && employee.clients && employee.clients.length > 0 && (
                              <div className="mb-4">
                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-2">
                                  <Building2 className="w-4 h-4" />
                                  <span>Clients</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {employee.clients.slice(0, 3).map((client) => (
                                    <span key={client.id} className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">
                                      {client.client_code}
                                    </span>
                                  ))}
                                  {employee.clients.length > 3 && (
                                    <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium">
                                      +{employee.clients.length - 3} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Stats */}
                            {hasStats && (
                              <>
                                <div className="border-t-2 border-slate-100 pt-4 mb-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                                      <Award className="w-4 h-4" />
                                      EBES Score
                                    </span>
                                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${getPerformanceColor(employee.stats.ebes_score)}`}>
                                      {employee.stats.ebes_score}
                                    </span>
                                  </div>
                                </div>

                                {/* Role-specific stats */}
                                <div className="grid grid-cols-2 gap-3">
                                  {employee.role === 'recruiter' && (
                                    <>
                                      <div className="bg-slate-50 rounded-lg p-3 text-center">
                                        <div className="text-2xl font-bold text-slate-800">{employee.stats.total_submissions}</div>
                                        <div className="text-xs text-slate-600 mt-1">Submissions</div>
                                      </div>
                                      <div className="bg-blue-50 rounded-lg p-3 text-center">
                                        <div className="text-2xl font-bold text-blue-700">{employee.stats.total_interviews}</div>
                                        <div className="text-xs text-blue-600 mt-1">Interviews</div>
                                      </div>
                                      <div className="bg-green-50 rounded-lg p-3 text-center">
                                        <div className="text-2xl font-bold text-green-700">{employee.stats.total_deals}</div>
                                        <div className="text-xs text-green-600 mt-1">Deals</div>
                                      </div>
                                      <div className="bg-purple-50 rounded-lg p-3 text-center">
                                        <div className="text-2xl font-bold text-purple-700">{employee.stats.active_roles}</div>
                                        <div className="text-xs text-purple-600 mt-1">Active Roles</div>
                                      </div>
                                    </>
                                  )}

                                  {employee.role === 'account_manager' && (
                                    <>
                                      <div className="bg-slate-50 rounded-lg p-3 text-center">
                                        <div className="text-2xl font-bold text-slate-800">{employee.stats.total_roles}</div>
                                        <div className="text-xs text-slate-600 mt-1">Total Roles</div>
                                      </div>
                                      <div className="bg-blue-50 rounded-lg p-3 text-center">
                                        <div className="text-2xl font-bold text-blue-700">{employee.stats.active_roles}</div>
                                        <div className="text-xs text-blue-600 mt-1">Active</div>
                                      </div>
                                      <div className="bg-green-50 rounded-lg p-3 text-center">
                                        <div className="text-2xl font-bold text-green-700">{employee.stats.deals_closed}</div>
                                        <div className="text-xs text-green-600 mt-1">Deals Closed</div>
                                      </div>
                                      <div className="bg-purple-50 rounded-lg p-3 text-center">
                                        <div className="text-2xl font-bold text-purple-700">{employee.stats.total_interviews}</div>
                                        <div className="text-xs text-purple-600 mt-1">Interviews</div>
                                      </div>
                                    </>
                                  )}

                                  {employee.role === 'recruitment_manager' && (
                                    <>
                                      <div className="bg-slate-50 rounded-lg p-3 text-center">
                                        <div className="text-2xl font-bold text-slate-800">{employee.stats.managed_teams}</div>
                                        <div className="text-xs text-slate-600 mt-1">Teams</div>
                                      </div>
                                      <div className="bg-blue-50 rounded-lg p-3 text-center">
                                        <div className="text-2xl font-bold text-blue-700">{employee.stats.total_recruiters}</div>
                                        <div className="text-xs text-blue-600 mt-1">Recruiters</div>
                                      </div>
                                      <div className="bg-green-50 rounded-lg p-3 text-center">
                                        <div className="text-2xl font-bold text-green-700">{employee.stats.total_deals}</div>
                                        <div className="text-xs text-green-600 mt-1">Team Deals</div>
                                      </div>
                                      <div className="bg-purple-50 rounded-lg p-3 text-center">
                                        <div className="text-2xl font-bold text-purple-700">{employee.stats.active_roles}</div>
                                        <div className="text-xs text-purple-600 mt-1">Active Roles</div>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </>
                            )}

                            {!hasStats && (
                              <div className="border-t-2 border-slate-100 pt-4">
                                <p className="text-sm text-slate-500 text-center italic">
                                  Statistics not available
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Empty State */}
                  {employees.length === 0 && (
                    <div className="bg-white rounded-2xl shadow-lg border-2 border-slate-200 p-12 text-center">
                      <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-slate-700 mb-2">No Employees Found</h3>
                      <p className="text-slate-500">
                        {searchQuery || roleFilter !== "all" 
                          ? "Try adjusting your search or filters"
                          : "No employee profiles are available at this time"
                        }
                      </p>
                    </div>
                  )}

                  {/* Info Box */}
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Users className="w-5 h-5 text-blue-600" />
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold text-blue-900 mb-1">About Employee Profiles</h4>
                        <p className="text-sm text-blue-700 mb-2">
                          This directory shows all active employees except administrators. Statistics shown depend on visibility settings configured by your admin.
                        </p>
                        <ul className="text-sm text-blue-700 space-y-1">
                          {employeeSettings.show_recruiter_stats && <li>• Recruiter performance metrics are visible</li>}
                          {employeeSettings.show_am_stats && <li>• Account Manager statistics are visible</li>}
                          {employeeSettings.show_rm_stats && <li>• Recruitment Manager data is visible</li>}
                          {employeeSettings.show_client_stats && <li>• Client assignments are visible</li>}
                          {employeeSettings.show_team_stats && <li>• Team assignments are visible</li>}
                        </ul>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
