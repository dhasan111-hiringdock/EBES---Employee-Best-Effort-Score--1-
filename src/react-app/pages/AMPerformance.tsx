import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Award, Target, Briefcase, Users, CheckCircle, XCircle, Clock, AlertCircle, BarChart3, Eye, Download } from "lucide-react";
import { fetchWithAuth } from "@/react-app/utils/api";
import ScoreTooltip from "@/react-app/components/shared/ScoreTooltip";
import ClientDetailsModal from "@/react-app/components/am/ClientDetailsModal";
import ReportDownloadModal, { type ReportFilters } from "@/react-app/components/admin/ReportDownloadModal";

interface PerformanceData {
  total_roles: number;
  active_roles: number;
  non_active_roles: number;
  total_interviews: number;
  interview_1_count: number;
  interview_2_count: number;
  total_deals: number;
  total_lost: number;
  total_on_hold: number;
  total_no_answer: number;
  total_cancelled: number;
  ebes_score: number;
  performance_label: string;
  current_month: {
    roles: number;
    interviews: number;
    deals: number;
    lost: number;
  };
  last_month: {
    roles: number;
    interviews: number;
    deals: number;
    lost: number;
  };
  roles_to_interviews_conversion: number;
  interviews_to_deals_conversion: number;
}

interface ClientPerformance {
  client_id: number;
  client_name: string;
  client_code: string;
  total_roles: number;
  active_roles: number;
  interview_1: number;
  interview_2: number;
  deals: number;
  lost: number;
  on_hold: number;
  no_answer: number;
  health: string;
}

interface TeamPerformance {
  team_id: number;
  team_name: string;
  team_code: string;
  total_roles: number;
  active_roles: number;
  total_interviews: number;
  total_deals: number;
  total_lost: number;
  performance_label: string;
}

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

export default function AMPerformance() {
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [clientPerformance, setClientPerformance] = useState<ClientPerformance[]>([]);
  const [teamPerformance, setTeamPerformance] = useState<TeamPerformance[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedClient, setSelectedClient] = useState<number | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("this_month");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [selectedClientDetails, setSelectedClientDetails] = useState<ClientPerformance | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    fetchAssignments();
  }, []);

  useEffect(() => {
    if (clients.length > 0 || teams.length > 0) {
      fetchPerformanceData();
    }
  }, [clients, teams, selectedClient, selectedTeam, selectedStatus, dateRange, customStartDate, customEndDate]);

  const fetchAssignments = async () => {
    try {
      const response = await fetchWithAuth("/api/am/assignments");
      if (response.ok) {
        const data = await response.json();
        setClients(data.clients || []);
        setTeams(data.teams || []);
      }
    } catch (error) {
      console.error("Failed to fetch assignments:", error);
    }
  };

  const fetchPerformanceData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedClient) params.append("client_id", selectedClient.toString());
      if (selectedTeam) params.append("team_id", selectedTeam.toString());
      if (selectedStatus !== "all") params.append("status", selectedStatus);
      
      // Date range handling
      if (dateRange === "custom" && customStartDate && customEndDate) {
        params.append("start_date", customStartDate);
        params.append("end_date", customEndDate);
      } else if (dateRange !== "all_time") {
        params.append("date_range", dateRange);
      }

      const response = await fetchWithAuth(`/api/am/performance?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setPerformance(data.overview);
        setClientPerformance(data.client_performance || []);
        setTeamPerformance(data.team_performance || []);
      }
    } catch (error) {
      console.error("Failed to fetch performance data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReportDownload = async (filters: ReportFilters, format: 'csv' | 'excel' | 'pdf') => {
    const selectedFields = (filters.fields && filters.fields.length > 0) ? filters.fields : [
      'user_info','ebes_score','teams','clients','total_roles','active_roles','interviews_1','interviews_2','total_interviews','deals','lost_roles','on_hold_roles','no_answer_roles'
    ];

    const params = new URLSearchParams();
    if (filters.clientId && filters.clientId !== 'all') params.append('client_id', filters.clientId);
    if (filters.teamId && filters.teamId !== 'all') params.append('team_id', filters.teamId);
    if (filters.dateRange === 'custom' && filters.startDate && filters.endDate) {
      params.append('start_date', filters.startDate);
      params.append('end_date', filters.endDate);
    } else if (filters.dateRange && filters.dateRange !== 'all') {
      if (filters.dateRange === 'today') {
        const today = new Date().toISOString().split('T')[0];
        params.append('start_date', today);
        params.append('end_date', today);
      } else {
        const map: Record<string,string> = { week: 'this_week', month: 'this_month' };
        const dr = map[filters.dateRange];
        if (dr) params.append('date_range', dr);
      }
    }

    let fresh: any = null;
    try {
      const res = await fetchWithAuth(`/api/am/performance?${params.toString()}`);
      if (res.ok) fresh = await res.json();
    } catch {}

    const p = (fresh?.overview || performance) || {
      total_roles: 0,
      active_roles: 0,
      interview_1_count: 0,
      interview_2_count: 0,
      total_interviews: 0,
      total_deals: 0,
      total_lost: 0,
      total_on_hold: 0,
      total_no_answer: 0,
      ebes_score: 0,
      performance_label: ''
    } as any;

    const userStr = localStorage.getItem('user') || '{}';
    let userName = '';
    let userCode = '';
    let userEmail = '';
    try {
      const u = JSON.parse(userStr);
      userName = u.name || '';
      userCode = u.user_code || '';
      userEmail = u.email || '';
    } catch {}

    const headerMap: Record<string, string[]> = {
      user_info: ['Name','User Code','Email'],
      ebes_score: ['EBES Score','Performance'],
      teams: ['Teams'],
      clients: ['Clients'],
      total_roles: ['Total Roles'],
      active_roles: ['Active Roles'],
      interviews_1: ['Interview 1'],
      interviews_2: ['Interview 2'],
      total_interviews: ['Total Interviews'],
      deals: ['Deals'],
      lost_roles: ['Lost'],
      on_hold_roles: ['On Hold'],
      no_answer_roles: ['No Answer'],
      roles_to_interviews_pct: ['Roles → Interviews %'],
      interviews_to_deals_pct: ['Interviews → Deals %'],
      stage_1_to_2_dropoff_pct: ['Stage 1→2 Drop-off %'],
      active_roles_pct: ['Active Roles %'],
      lost_rate_pct: ['Lost Rate %']
    };
    if (format === 'csv') {
      const headers: string[] = [];
      selectedFields.forEach((f) => { const h = headerMap[f]; if (h) headers.push(...h); });
      const parts: string[] = [];
      selectedFields.forEach((f) => {
        if (f === 'user_info') parts.push(`"${userName}"`, userCode, userEmail);
        else if (f === 'ebes_score') parts.push(String(p.ebes_score || 0), (p.performance_label || ''));
        else if (f === 'teams') parts.push(`"${teams.map(t => t.name).join('; ')}"`);
        else if (f === 'clients') parts.push(`"${clients.map(c => c.name).join('; ')}"`);
        else if (f === 'total_roles') parts.push(String(p.total_roles || 0));
        else if (f === 'active_roles') parts.push(String(p.active_roles || 0));
        else if (f === 'interviews_1') parts.push(String(p.interview_1_count || 0));
        else if (f === 'interviews_2') parts.push(String(p.interview_2_count || 0));
        else if (f === 'total_interviews') parts.push(String(p.total_interviews || 0));
        else if (f === 'deals') parts.push(String(p.total_deals || 0));
        else if (f === 'lost_roles') parts.push(String(p.total_lost || 0));
        else if (f === 'on_hold_roles') parts.push(String(p.total_on_hold || 0));
        else if (f === 'no_answer_roles') parts.push(String(p.total_no_answer || 0));
        else if (f === 'roles_to_interviews_pct') {
          const tr = p.total_roles || 0;
          const pct = tr > 0 ? Math.round(((p.total_interviews || 0) / tr) * 1000) / 10 : 0;
          parts.push(String(pct));
        } else if (f === 'interviews_to_deals_pct') {
          const ti = p.total_interviews || 0;
          const pct = ti > 0 ? Math.round(((p.total_deals || 0) / ti) * 1000) / 10 : 0;
          parts.push(String(pct));
        } else if (f === 'stage_1_to_2_dropoff_pct') {
          const i1 = p.interview_1_count || 0;
          const i2 = p.interview_2_count || 0;
          const pct = i1 > 0 ? Math.round(((i1 - i2) / i1) * 1000) / 10 : 0;
          parts.push(String(pct));
        } else if (f === 'active_roles_pct') {
          const tr = p.total_roles || 0;
          const pct = tr > 0 ? Math.round(((p.active_roles || 0) / tr) * 1000) / 10 : 0;
          parts.push(String(pct));
        } else if (f === 'lost_rate_pct') {
          const tr = p.total_roles || 0;
          const pct = tr > 0 ? Math.round(((p.total_lost || 0) / tr) * 1000) / 10 : 0;
          parts.push(String(pct));
        }
      });
      const blob = new Blob([[headers.join(',') , parts.join(',')].join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `am-report-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'excel') {
      const headers: string[] = [];
      selectedFields.forEach((f) => { const h = headerMap[f]; if (h) headers.push(...h); });
      const parts: string[] = [];
      selectedFields.forEach((f) => {
        if (f === 'total_roles') parts.push(String(p.total_roles || 0));
        else if (f === 'active_roles') parts.push(String(p.active_roles || 0));
        else if (f === 'interviews_1') parts.push(String(p.interview_1_count || 0));
        else if (f === 'interviews_2') parts.push(String(p.interview_2_count || 0));
        else if (f === 'total_interviews') parts.push(String(p.total_interviews || 0));
        else if (f === 'deals') parts.push(String(p.total_deals || 0));
        else if (f === 'lost_roles') parts.push(String(p.total_lost || 0));
        else if (f === 'on_hold_roles') parts.push(String(p.total_on_hold || 0));
        else if (f === 'no_answer_roles') parts.push(String(p.total_no_answer || 0));
      });
      const rows = [`"AM Report - ${new Date().toLocaleDateString()}"`,'', headers.join(','), parts.join(',')];
      const blob = new Blob([rows.join('\n')], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `am-report-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const headers: string[] = [];
      selectedFields.forEach((f) => { const h = headerMap[f]; if (h) headers.push(...h); });
      const cells: string[] = [];
      selectedFields.forEach((f) => {
        if (f === 'user_info') cells.push(`"${userName}"`, userCode, userEmail);
        else if (f === 'ebes_score') cells.push(String(p.ebes_score || 0), (p.performance_label || ''));
        else if (f === 'teams') cells.push(`"${teams.map(t => t.name).join('; ')}"`);
        else if (f === 'clients') cells.push(`"${clients.map(c => c.name).join('; ')}"`);
        else if (f === 'total_roles') cells.push(String(p.total_roles || 0));
        else if (f === 'active_roles') cells.push(String(p.active_roles || 0));
        else if (f === 'interviews_1') cells.push(String(p.interview_1_count || 0));
        else if (f === 'interviews_2') cells.push(String(p.interview_2_count || 0));
        else if (f === 'total_interviews') cells.push(String(p.total_interviews || 0));
        else if (f === 'deals') cells.push(String(p.total_deals || 0));
        else if (f === 'lost_roles') cells.push(String(p.total_lost || 0));
        else if (f === 'on_hold_roles') cells.push(String(p.total_on_hold || 0));
        else if (f === 'no_answer_roles') cells.push(String(p.total_no_answer || 0));
      });
      const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>AM Report</title></head><body><h2>Account Manager Report</h2><table style=\"border-collapse:collapse;width:100%\"><thead><tr>${headers.map((h) => `<th style=\"padding:8px;border:1px solid #ddd;text-align:left\">${h}</th>`).join('')}</tr></thead><tbody><tr>${cells.map((p) => `<td style=\"padding:8px;border:1px solid #ddd;\">${p}</td>`).join('')}</tr></tbody></table></body></html>`;
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const w = window.open(url);
      if (w) { w.addEventListener('load', () => { w.print(); }); }
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case "Strong":
        return "bg-green-100 text-green-800 border-green-200";
      case "Average":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "At Risk":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (current < previous) return <TrendingDown className="w-4 h-4 text-red-600" />;
    return null;
  };

  const getTrendPercentage = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? "+100%" : "0%";
    const change = ((current - previous) / previous) * 100;
    return `${change > 0 ? "+" : ""}${change.toFixed(1)}%`;
  };

  if (loading && !performance) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Performance Dashboard</h2>
        <p className="text-gray-600 mt-1">Track your role management and deal closures</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Client Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Client</label>
            <select
              value={selectedClient || ""}
              onChange={(e) => setSelectedClient(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All Clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} ({client.client_code})
                </option>
              ))}
            </select>
          </div>

          {/* Team Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Team</label>
            <select
              value={selectedTeam || ""}
              onChange={(e) => setSelectedTeam(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All Teams</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name} ({team.team_code})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="deal">Deal</option>
              <option value="lost">Lost</option>
              <option value="on_hold">On Hold</option>
              <option value="no_answer">No Answer</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Date Range Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="custom">Custom Range</option>
              <option value="all_time">All Time</option>
            </select>
          </div>
        </div>

        {/* Custom Date Range */}
        {dateRange === "custom" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end -mt-2">
        <button
          onClick={() => setShowReportModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all font-medium shadow-lg"
        >
          <Download className="w-4 h-4" />
          Download Report
        </button>
      </div>

      {performance && (
        <>
          {/* EBES Score */}
          <div className={`bg-gradient-to-br rounded-xl p-8 text-white shadow-2xl ${
            performance.performance_label === "Excellent"
              ? "from-green-500 to-green-600"
              : performance.performance_label === "Strong"
              ? "from-blue-500 to-blue-600"
              : performance.performance_label === "Average"
              ? "from-yellow-500 to-yellow-600"
              : "from-red-500 to-red-600"
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Award className="w-8 h-8" />
                  <h3 className="text-2xl font-bold">Your EBES Score</h3>
                </div>
                <div className="mt-4">
                  <ScoreTooltip 
                    type="ebes" 
                    score={performance.ebes_score} 
                    label={performance.performance_label}
                    className="text-white"
                  />
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <span className="px-4 py-2 bg-white bg-opacity-20 rounded-full text-sm font-semibold backdrop-blur-sm">
                    {performance.performance_label}
                  </span>
                </div>
              </div>
              <div className="text-right opacity-90">
                <p className="text-sm mb-2">Performance Rating</p>
                <div className="text-4xl">
                  {performance.performance_label === "Excellent" && "🌟"}
                  {performance.performance_label === "Strong" && "💪"}
                  {performance.performance_label === "Average" && "📊"}
                  {performance.performance_label === "At Risk" && "⚠️"}
                </div>
              </div>
            </div>
          </div>

          {/* Core Performance Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-2">
                <Briefcase className="w-5 h-5 text-indigo-600" />
                <p className="text-sm font-medium text-gray-600">Total Roles</p>
              </div>
              <p className="text-3xl font-bold text-gray-900">{performance.total_roles}</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-2">
                <Target className="w-5 h-5 text-blue-600" />
                <p className="text-sm font-medium text-gray-600">Active Roles</p>
              </div>
              <p className="text-3xl font-bold text-blue-600">{performance.active_roles}</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-2">
                <BarChart3 className="w-5 h-5 text-purple-600" />
                <p className="text-sm font-medium text-gray-600">Non-Active</p>
              </div>
              <p className="text-3xl font-bold text-gray-900">{performance.non_active_roles}</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-5 h-5 text-teal-600" />
                <p className="text-sm font-medium text-gray-600">Interviews</p>
              </div>
              <p className="text-3xl font-bold text-teal-600">{performance.total_interviews}</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="text-sm font-medium text-gray-600">Deals</p>
              </div>
              <p className="text-3xl font-bold text-green-600">{performance.total_deals}</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-2">
                <XCircle className="w-5 h-5 text-red-600" />
                <p className="text-sm font-medium text-gray-600">Lost</p>
              </div>
              <p className="text-3xl font-bold text-red-600">{performance.total_lost}</p>
            </div>
          </div>

          {/* Interview Breakdown */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Interview Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center p-4 bg-gradient-to-br from-teal-50 to-teal-100 rounded-lg">
                <p className="text-sm font-medium text-gray-600 mb-2">Interview 1</p>
                <p className="text-4xl font-bold text-teal-700">{performance.interview_1_count}</p>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                <p className="text-sm font-medium text-gray-600 mb-2">Interview 2</p>
                <p className="text-4xl font-bold text-blue-700">{performance.interview_2_count}</p>
              </div>
          
              <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                <p className="text-sm font-medium text-gray-600 mb-2">Deals Closed</p>
                <p className="text-4xl font-bold text-green-700">{performance.total_deals}</p>
              </div>
            </div>
          </div>

          {/* Role Status Breakdown */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Role Status Breakdown</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-5 h-5 text-blue-600" />
                  <p className="text-xs font-semibold text-blue-900">Active</p>
                </div>
                <p className="text-3xl font-bold text-blue-700">{performance.active_roles}</p>
                <p className="text-xs text-blue-600 mt-1">In Progress</p>
              </div>

              <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <p className="text-xs font-semibold text-green-900">Deal</p>
                </div>
                <p className="text-3xl font-bold text-green-700">{performance.total_deals}</p>
                <p className="text-xs text-green-600 mt-1">+12 pts each</p>
              </div>

              <div className="p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-lg border border-red-200">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="w-5 h-5 text-red-600" />
                  <p className="text-xs font-semibold text-red-900">Lost</p>
                </div>
                <p className="text-3xl font-bold text-red-700">{performance.total_lost}</p>
                <p className="text-xs text-red-600 mt-1">-12 pts each</p>
              </div>

              <div className="p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg border border-yellow-200">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-yellow-600" />
                  <p className="text-xs font-semibold text-yellow-900">On Hold</p>
                </div>
                <p className="text-3xl font-bold text-yellow-700">{performance.total_on_hold}</p>
                <p className="text-xs text-yellow-600 mt-1">-0.5 pt each</p>
              </div>

              <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg border border-orange-200">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                  <p className="text-xs font-semibold text-orange-900">No Answer</p>
                </div>
                <p className="text-3xl font-bold text-orange-700">{performance.total_no_answer}</p>
                <p className="text-xs text-orange-600 mt-1">-10 pts each</p>
              </div>

              <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="w-5 h-5 text-gray-600" />
                  <p className="text-xs font-semibold text-gray-900">Cancelled</p>
                </div>
                <p className="text-3xl font-bold text-gray-700">{performance.total_cancelled}</p>
                <p className="text-xs text-gray-600 mt-1">-10 pts each</p>
              </div>
            </div>
            
            {/* EBES Impact Summary */}
            <div className="mt-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
              <h4 className="text-sm font-semibold text-indigo-900 mb-3">EBES Calculation Impact</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-indigo-700 font-medium mb-2">Positive Contributions:</p>
                  <ul className="space-y-1 text-indigo-600">
                    <li>• New Roles: {performance.total_roles} × 2 = <span className="font-semibold">{performance.total_roles * 2} pts</span></li>
                    <li>• Interview 1: {performance.interview_1_count} × 2 = <span className="font-semibold">{performance.interview_1_count * 2} pts</span></li>
                    <li>• Interview 2: {performance.interview_2_count} × 2 = <span className="font-semibold">{performance.interview_2_count * 2} pts</span></li>
                    <li>• Deals: {performance.total_deals} × 12 = <span className="font-semibold">{performance.total_deals * 12} pts</span></li>
                  </ul>
                </div>
                <div>
                  <p className="text-red-700 font-medium mb-2">Penalties Applied:</p>
                  <ul className="space-y-1 text-red-600">
                    <li>• Lost: {performance.total_lost} × -12 = <span className="font-semibold">{performance.total_lost * -12} pts</span></li>
                    <li>• No Answer: {performance.total_no_answer} × -10 = <span className="font-semibold">{performance.total_no_answer * -10} pts</span></li>
                    <li>• Cancelled: {performance.total_cancelled} × -10 = <span className="font-semibold">{performance.total_cancelled * -10} pts</span></li>
                    <li>• On Hold: {performance.total_on_hold} × -0.5 = <span className="font-semibold">{performance.total_on_hold * -0.5} pts</span></li>
                    {performance.active_roles > 15 && performance.total_deals === 0 && (
                      <li>• High Active + No Deals: <span className="font-semibold">-20 pts</span></li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Trends & Comparison */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">This Month vs Last Month</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-3">Roles Created</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{performance.current_month.roles}</p>
                    <p className="text-xs text-gray-500">This month</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      {getTrendIcon(performance.current_month.roles, performance.last_month.roles)}
                      <span className={`text-sm font-semibold ${
                        performance.current_month.roles > performance.last_month.roles
                          ? "text-green-600"
                          : performance.current_month.roles < performance.last_month.roles
                          ? "text-red-600"
                          : "text-gray-600"
                      }`}>
                        {getTrendPercentage(performance.current_month.roles, performance.last_month.roles)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">vs {performance.last_month.roles} last month</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-600 mb-3">Interviews</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{performance.current_month.interviews}</p>
                    <p className="text-xs text-gray-500">This month</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      {getTrendIcon(performance.current_month.interviews, performance.last_month.interviews)}
                      <span className={`text-sm font-semibold ${
                        performance.current_month.interviews > performance.last_month.interviews
                          ? "text-green-600"
                          : performance.current_month.interviews < performance.last_month.interviews
                          ? "text-red-600"
                          : "text-gray-600"
                      }`}>
                        {getTrendPercentage(performance.current_month.interviews, performance.last_month.interviews)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">vs {performance.last_month.interviews} last month</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-600 mb-3">Deals</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{performance.current_month.deals}</p>
                    <p className="text-xs text-gray-500">This month</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      {getTrendIcon(performance.current_month.deals, performance.last_month.deals)}
                      <span className={`text-sm font-semibold ${
                        performance.current_month.deals > performance.last_month.deals
                          ? "text-green-600"
                          : performance.current_month.deals < performance.last_month.deals
                          ? "text-red-600"
                          : "text-gray-600"
                      }`}>
                        {getTrendPercentage(performance.current_month.deals, performance.last_month.deals)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">vs {performance.last_month.deals} last month</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-600 mb-3">Lost Roles</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{performance.current_month.lost}</p>
                    <p className="text-xs text-gray-500">This month</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      {getTrendIcon(performance.last_month.lost, performance.current_month.lost)}
                      <span className={`text-sm font-semibold ${
                        performance.current_month.lost < performance.last_month.lost
                          ? "text-green-600"
                          : performance.current_month.lost > performance.last_month.lost
                          ? "text-red-600"
                          : "text-gray-600"
                      }`}>
                        {getTrendPercentage(performance.current_month.lost, performance.last_month.lost)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">vs {performance.last_month.lost} last month</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Conversion View */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Rates</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                <p className="text-sm font-medium text-gray-700 mb-2">Roles → Interviews</p>
                <p className="text-4xl font-bold text-blue-700 mb-2">{performance.roles_to_interviews_conversion.toFixed(1)}%</p>
                <p className="text-xs text-gray-600">
                  {performance.total_interviews} interviews from {performance.total_roles} roles
                </p>
              </div>
              <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
                <p className="text-sm font-medium text-gray-700 mb-2">Interview Success</p>
                <p className="text-4xl font-bold text-green-700 mb-2">{performance.interviews_to_deals_conversion.toFixed(1)}%</p>
                <p className="text-xs text-gray-600">
                  {performance.total_deals} deals from {performance.total_interviews} interviews
                </p>
              </div>
            </div>
          </div>

          {/* Client-Wise Performance */}
          {clientPerformance.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Client-Wise Performance</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Client</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Total Roles</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Active</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Interview 1</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Interview 2</th>
                      
                      <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Deals</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Lost</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">On Hold</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">No Answer</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Cancelled</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Health</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientPerformance.map((client) => (
                      <tr key={client.client_id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-gray-900">{client.client_name}</p>
                            <p className="text-xs text-gray-500">{client.client_code}</p>
                          </div>
                        </td>
                        <td className="text-center py-3 px-4 font-semibold text-gray-900">{client.total_roles}</td>
                        <td className="text-center py-3 px-4 font-semibold text-blue-600">{client.active_roles}</td>
                        <td className="text-center py-3 px-4 text-gray-700">{client.interview_1}</td>
                        <td className="text-center py-3 px-4 text-gray-700">{client.interview_2}</td>
                        
                        <td className="text-center py-3 px-4 font-semibold text-green-600">{client.deals}</td>
                        <td className="text-center py-3 px-4 font-semibold text-red-600">{client.lost}</td>
                        <td className="text-center py-3 px-4 text-yellow-600">{client.on_hold}</td>
                        <td className="text-center py-3 px-4 text-orange-600">{client.no_answer}</td>
                        <td className="text-center py-3 px-4 text-gray-600">{(client as any).cancelled || 0}</td>
                        <td className="text-center py-3 px-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getHealthColor(client.health)}`}>
                            {client.health}
                          </span>
                        </td>
                        <td className="text-center py-3 px-4">
                          <button
                            onClick={() => setSelectedClientDetails(client)}
                            className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors inline-flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Team-Wise Performance */}
          {teamPerformance.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Team-Wise Performance</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teamPerformance.map((team) => (
                  <div
                    key={team.team_id}
                    className="p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200"
                  >
                    <div className="mb-4">
                      <p className="font-semibold text-gray-900">{team.team_name}</p>
                      <p className="text-xs text-gray-500">{team.team_code}</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Total Roles:</span>
                        <span className="font-semibold text-gray-900">{team.total_roles}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Active:</span>
                        <span className="font-semibold text-blue-600">{team.active_roles}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Interviews:</span>
                        <span className="font-semibold text-teal-600">{team.total_interviews}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Deals:</span>
                        <span className="font-semibold text-green-600">{team.total_deals}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Lost:</span>
                        <span className="font-semibold text-red-600">{team.total_lost}</span>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-300">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getHealthColor(team.performance_label)}`}>
                        {team.performance_label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Client Details Modal */}
      {selectedClientDetails && (
        <ClientDetailsModal
          client={selectedClientDetails}
          onClose={() => setSelectedClientDetails(null)}
        />
      )}

      <ReportDownloadModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        teams={teams}
        clients={clients}
        onDownload={handleReportDownload}
        allowedRoles={["account_manager","recruiter"]}
      />
    </div>
  );
}
