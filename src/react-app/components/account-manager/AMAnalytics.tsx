import { useState, useEffect } from "react";
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Target,
  Users,
  Building2,
  Calendar,
  Award,
  BarChart3,
  Download,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Activity,
  Zap,
  DollarSign,
  Percent,
  HelpCircle,
  Lightbulb,
  Eye
} from "lucide-react";
import { fetchWithAuth } from "@/react-app/utils/api";
import ReportDownloadModal, { type ReportFilters } from "@/react-app/components/admin/ReportDownloadModal";
import ScoreTooltip from "@/react-app/components/shared/ScoreTooltip";
import ClientDetailsModal from "@/react-app/components/am/ClientDetailsModal";
import {
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ComposedChart
} from "recharts";

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

const COLORS = {
  primary: '#6366f1',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  purple: '#8b5cf6',
  pink: '#ec4899',
  teal: '#14b8a6',
};

// const STATUS_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AMAnalytics() {
  const [loading, setLoading] = useState(true);
  const [ebesScore, setEbesScore] = useState(0);
  const [performanceLabel, setPerformanceLabel] = useState("Average");
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [trendData, setTrendData] = useState<any[]>([]);
  
  // Filters
  const [clients, setClients] = useState<Client[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<"current" | "last" | "custom">("current");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedClientDetails, setSelectedClientDetails] = useState<any | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    fetchAssignments();
  }, []);

  useEffect(() => {
    fetchData();
    fetchTrendData();
  }, [selectedClient, selectedTeam, dateFilter, customStartDate, customEndDate]);

  const fetchAssignments = async () => {
    try {
      const response = await fetchWithAuth("/api/am/assignments");
      if (response.ok) {
        const data = await response.json();
        setClients(data.clients);
        setTeams(data.teams);
      }
    } catch (error) {
      console.error("Failed to fetch assignments:", error);
    }
  };

  const fetchTrendData = async () => {
    // Generate last 6 months trend data
    const months = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      try {
        const startDate = `${monthStr}-01`;
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        const endDate = `${monthStr}-${lastDay}`;
        
        const params = new URLSearchParams();
        params.append("start_date", startDate);
        params.append("end_date", endDate);
        
        const ebesResponse = await fetchWithAuth(`/api/am/ebes-score?${params.toString()}`);
        const analyticsResponse = await fetchWithAuth(`/api/am/analytics?${params.toString()}`);
        
        let ebes = 0;
        let roles = 0;
        let deals = 0;
        let interviews = 0;
        
        if (ebesResponse.ok) {
          const ebesData = await ebesResponse.json();
          ebes = ebesData.score;
        }
        
        if (analyticsResponse.ok) {
          const data = await analyticsResponse.json();
          roles = data.clients.reduce((sum: number, c: any) => sum + c.total_roles, 0);
          deals = data.clients.reduce((sum: number, c: any) => sum + c.deal_roles, 0);
          interviews = data.clients.reduce((sum: number, c: any) => sum + c.total_interviews, 0);
        }
        
        months.push({
          month: date.toLocaleDateString('en-US', { month: 'short' }),
          ebes,
          roles,
          deals,
          interviews,
          conversion: roles > 0 ? Math.round((deals / roles) * 100) : 0
        });
      } catch (error) {
        console.error("Failed to fetch trend for month:", monthStr);
      }
    }
    
    setTrendData(months);
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

    const p = (fresh?.overview) || {
      total_roles: 0,
      active_roles: 0,
      interview_1_count: 0,
      interview_2_count: 0,
      total_interviews: 0,
      total_deals: 0,
      total_lost: 0,
      total_on_hold: 0,
      total_no_answer: 0,
      ebes_score: ebesScore || 0,
      performance_label: performanceLabel || ''
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
      no_answer_roles: ['No Answer']
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

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      
      if (dateFilter === "current") {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        params.append("start_date", startOfMonth.toISOString().split('T')[0]);
        params.append("end_date", endOfMonth.toISOString().split('T')[0]);
      } else if (dateFilter === "last") {
        const now = new Date();
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        params.append("start_date", startOfLastMonth.toISOString().split('T')[0]);
        params.append("end_date", endOfLastMonth.toISOString().split('T')[0]);
      } else if (dateFilter === "custom" && customStartDate && customEndDate) {
        params.append("start_date", customStartDate);
        params.append("end_date", customEndDate);
      }

      const ebesResponse = await fetchWithAuth(`/api/am/ebes-score?${params.toString()}`);
      if (ebesResponse.ok) {
        const ebesData = await ebesResponse.json();
        setEbesScore(ebesData.score);
        setPerformanceLabel(ebesData.performance_label);
      }

      const analyticsResponse = await fetchWithAuth(`/api/am/analytics?${params.toString()}`);
      if (analyticsResponse.ok) {
        const data = await analyticsResponse.json();
        setAnalyticsData(data);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getDateLabel = () => {
    if (dateFilter === "current") {
      const now = new Date();
      return `Current Month - ${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
    } else if (dateFilter === "last") {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      return `Last Month - ${lastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
    } else if (dateFilter === "custom" && customStartDate && customEndDate) {
      return `${new Date(customStartDate).toLocaleDateString()} - ${new Date(customEndDate).toLocaleDateString()}`;
    }
    return "Select Date Range";
  };

  const getScoreColor = () => {
    if (performanceLabel === "Excellent") return "from-green-500 to-emerald-600";
    if (performanceLabel === "Strong") return "from-blue-500 to-indigo-600";
    if (performanceLabel === "At Risk") return "from-red-500 to-rose-600";
    return "from-yellow-500 to-amber-600";
  };



  const filteredClients = analyticsData?.clients?.filter((client: any) => {
    if (selectedClient !== "all" && client.client_id.toString() !== selectedClient) return false;
    return true;
  }) || [];

  // Prepare chart data
  const statusData = analyticsData ? [
    { name: 'Active', value: filteredClients.reduce((sum: number, c: any) => sum + c.active_roles, 0), color: COLORS.success },
    { name: 'Deals', value: filteredClients.reduce((sum: number, c: any) => sum + c.deal_roles, 0), color: COLORS.primary },
    { name: 'Lost', value: filteredClients.reduce((sum: number, c: any) => sum + c.lost_roles, 0), color: COLORS.danger },
    { name: 'On Hold', value: filteredClients.reduce((sum: number, c: any) => sum + c.on_hold_roles, 0), color: COLORS.warning },
    { name: 'Cancelled', value: filteredClients.reduce((sum: number, c: any) => sum + c.cancelled_roles, 0), color: COLORS.purple },
    { name: 'No Answer', value: filteredClients.reduce((sum: number, c: any) => sum + c.no_answer_roles, 0), color: COLORS.pink },
  ].filter(d => d.value > 0) : [];

  const interviewFunnelData = analyticsData ? [
    { stage: 'Level 1', count: filteredClients.reduce((sum: number, c: any) => sum + c.interview_1_count, 0) },
    { stage: 'Level 2', count: filteredClients.reduce((sum: number, c: any) => sum + c.interview_2_count, 0) },
    { stage: 'Level 3', count: filteredClients.reduce((sum: number, c: any) => sum + c.interview_3_count, 0) },
    { stage: 'Deals', count: filteredClients.reduce((sum: number, c: any) => sum + c.deal_roles, 0) },
  ] : [];

  const topClientsData = filteredClients
    .sort((a: any, b: any) => b.deal_roles - a.deal_roles)
    .slice(0, 5)
    .map((c: any) => ({
      name: c.client_code,
      deals: c.deal_roles,
      interviews: c.total_interviews,
      conversion: c.roles_to_deal_conversion
    }));

  const performanceRadarData = analyticsData ? [
    {
      metric: 'Deals',
      value: Math.min(100, (filteredClients.reduce((sum: number, c: any) => sum + c.deal_roles, 0) / Math.max(filteredClients.reduce((sum: number, c: any) => sum + c.total_roles, 0), 1)) * 100)
    },
    {
      metric: 'Interviews',
      value: Math.min(100, (filteredClients.reduce((sum: number, c: any) => sum + c.total_interviews, 0) / Math.max(filteredClients.reduce((sum: number, c: any) => sum + c.total_roles, 0) * 3, 1)) * 100)
    },
    {
      metric: 'Active Roles',
      value: Math.min(100, (filteredClients.reduce((sum: number, c: any) => sum + c.active_roles, 0) / Math.max(filteredClients.reduce((sum: number, c: any) => sum + c.total_roles, 0), 1)) * 100)
    },
    {
      metric: 'Response',
      value: Math.min(100, 100 - ((filteredClients.reduce((sum: number, c: any) => sum + c.no_answer_roles, 0) / Math.max(filteredClients.reduce((sum: number, c: any) => sum + c.total_roles, 0), 1)) * 100))
    },
    {
      metric: 'Retention',
      value: Math.min(100, 100 - ((filteredClients.reduce((sum: number, c: any) => sum + c.lost_roles + c.cancelled_roles, 0) / Math.max(filteredClients.reduce((sum: number, c: any) => sum + c.total_roles, 0), 1)) * 100))
    },
  ] : [];

  const getGrowthIndicator = (current: number, previous: number) => {
    if (previous === 0) return { icon: Minus, color: 'text-gray-400', text: 'N/A' };
    const growth = ((current - previous) / previous) * 100;
    if (growth > 0) return { icon: ArrowUpRight, color: 'text-green-600', text: `+${growth.toFixed(1)}%` };
    if (growth < 0) return { icon: ArrowDownRight, color: 'text-red-600', text: `${growth.toFixed(1)}%` };
    return { icon: Minus, color: 'text-gray-400', text: '0%' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Calculate totals for KPI cards
  const totalRoles = filteredClients.reduce((sum: number, c: any) => sum + c.total_roles, 0);
  const totalInterviews = filteredClients.reduce((sum: number, c: any) => sum + c.total_interviews, 0);
  const totalDeals = filteredClients.reduce((sum: number, c: any) => sum + c.deal_roles, 0);
  const avgConversion = totalRoles > 0 ? (totalDeals / totalRoles) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Advanced Performance Analytics
          </h2>
          <p className="text-gray-600 mt-1">Comprehensive insights and data visualization</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg"
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <button
            onClick={() => setShowReportModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all font-medium shadow-lg"
          >
            <Download className="w-4 h-4" />
            Download Report
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-xl shadow-lg border-2 border-indigo-100 p-6 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-semibold text-gray-900">Filter Options</h3>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Time Period</label>
            <div className="flex flex-wrap gap-3 mb-4">
              <button
                onClick={() => setDateFilter("current")}
                className={`px-6 py-2 rounded-lg font-medium transition-all ${
                  dateFilter === "current"
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Current Month
              </button>
              <button
                onClick={() => setDateFilter("last")}
                className={`px-6 py-2 rounded-lg font-medium transition-all ${
                  dateFilter === "last"
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Last Month
              </button>
              <button
                onClick={() => setDateFilter("custom")}
                className={`px-6 py-2 rounded-lg font-medium transition-all ${
                  dateFilter === "custom"
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Custom Range
              </button>
            </div>

            {dateFilter === "custom" && (
              <div className="flex flex-wrap items-end gap-4 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
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

            <p className="text-sm text-indigo-600 mt-2 font-medium">
              <Calendar className="w-4 h-4 inline mr-1" />
              {getDateLabel()}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Client</label>
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Clients</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id.toString()}>
                    {client.name} ({client.client_code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Team</label>
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Teams</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id.toString()}>
                    {team.name} ({team.team_code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* EBES Score Card */}
        <div className={`bg-gradient-to-br ${getScoreColor()} rounded-2xl shadow-xl p-6 text-white col-span-1 md:col-span-2 lg:col-span-1`}>
          <div className="flex items-center justify-between mb-2">
            <Award className="w-8 h-8 text-white/80" />
            <span className="text-xs font-semibold bg-white/20 px-3 py-1 rounded-full">{performanceLabel}</span>
          </div>
          <ScoreTooltip 
            type="ebes" 
            score={ebesScore} 
            label={performanceLabel}
            className="text-white"
          />
          <p className="text-sm text-white/80 mt-2">EBES Score</p>
        </div>

        {/* Total Roles */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-blue-100 p-6 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <Target className="w-8 h-8 text-blue-600" />
            <Zap className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{totalRoles}</div>
          <p className="text-sm text-gray-600">Total Roles</p>
          <div className="mt-2 flex items-center gap-1 text-xs">
            {(() => {
              const prev = analyticsData?.clients.reduce((sum: number, c: any) => sum + (c.last_month?.roles_created || 0), 0) || 0;
              const indicator = getGrowthIndicator(totalRoles, prev);
              const Icon = indicator.icon;
              return (
                <>
                  <Icon className={`w-3 h-3 ${indicator.color}`} />
                  <span className={indicator.color}>{indicator.text}</span>
                  <span className="text-gray-400">vs last period</span>
                </>
              );
            })()}
          </div>
        </div>

        {/* Total Interviews */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-purple-100 p-6 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 text-purple-600" />
            <Activity className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{totalInterviews}</div>
          <p className="text-sm text-gray-600">Total Interviews</p>
          <div className="mt-2 flex items-center gap-1 text-xs">
            {(() => {
              const prev = analyticsData?.clients.reduce((sum: number, c: any) => sum + (c.last_month?.interviews || 0), 0) || 0;
              const indicator = getGrowthIndicator(totalInterviews, prev);
              const Icon = indicator.icon;
              return (
                <>
                  <Icon className={`w-3 h-3 ${indicator.color}`} />
                  <span className={indicator.color}>{indicator.text}</span>
                  <span className="text-gray-400">vs last period</span>
                </>
              );
            })()}
          </div>
        </div>

        {/* Total Deals */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-green-100 p-6 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <DollarSign className="w-5 h-5 text-green-400" />
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{totalDeals}</div>
          <p className="text-sm text-gray-600">Closed Deals</p>
          <div className="mt-2 flex items-center gap-1 text-xs">
            {(() => {
              const prev = analyticsData?.clients.reduce((sum: number, c: any) => sum + (c.last_month?.deals || 0), 0) || 0;
              const indicator = getGrowthIndicator(totalDeals, prev);
              const Icon = indicator.icon;
              return (
                <>
                  <Icon className={`w-3 h-3 ${indicator.color}`} />
                  <span className={indicator.color}>{indicator.text}</span>
                  <span className="text-gray-400">vs last period</span>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Charts Row 1 - Trends and Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Trend Chart */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            <h3 className="text-xl font-bold text-gray-900">6-Month Performance Trend</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#6b7280" />
              <YAxis yAxisId="left" stroke="#6b7280" />
              <YAxis yAxisId="right" orientation="right" stroke="#6b7280" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', border: '2px solid #e5e7eb', borderRadius: '8px' }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="deals" fill={COLORS.success} name="Deals" radius={[8, 8, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="ebes" stroke={COLORS.primary} strokeWidth={3} name="EBES Score" dot={{ r: 5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Status Distribution Pie Chart */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-purple-600" />
            <h3 className="text-xl font-bold text-gray-900">Role Status Distribution</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.value}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 - Funnel and Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Interview Conversion Funnel */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-5 h-5 text-blue-600" />
            <h3 className="text-xl font-bold text-gray-900">Interview Conversion Funnel</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={interviewFunnelData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" stroke="#6b7280" />
              <YAxis dataKey="stage" type="category" stroke="#6b7280" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', border: '2px solid #e5e7eb', borderRadius: '8px' }}
              />
              <Bar dataKey="count" fill={COLORS.info} radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <p className="text-gray-600">L1 → L2</p>
              <p className="font-bold text-blue-600">
                {interviewFunnelData[0]?.count > 0 
                  ? Math.round((interviewFunnelData[1]?.count / interviewFunnelData[0]?.count) * 100) 
                  : 0}%
              </p>
            </div>
            <div>
              <p className="text-gray-600">L2 → L3</p>
              <p className="font-bold text-purple-600">
                {interviewFunnelData[1]?.count > 0 
                  ? Math.round((interviewFunnelData[2]?.count / interviewFunnelData[1]?.count) * 100) 
                  : 0}%
              </p>
            </div>
            <div>
              <p className="text-gray-600">L3 → Deal</p>
              <p className="font-bold text-green-600">
                {interviewFunnelData[2]?.count > 0 
                  ? Math.round((interviewFunnelData[3]?.count / interviewFunnelData[2]?.count) * 100) 
                  : 0}%
              </p>
            </div>
          </div>
        </div>

        {/* Performance Radar Chart */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-6">
            <Target className="w-5 h-5 text-pink-600" />
            <h3 className="text-xl font-bold text-gray-900">Performance Matrix</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={performanceRadarData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="metric" stroke="#6b7280" />
              <PolarRadiusAxis stroke="#6b7280" />
              <Radar
                name="Performance"
                dataKey="value"
                stroke={COLORS.purple}
                fill={COLORS.purple}
                fillOpacity={0.6}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Performers Chart */}
      <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-6">
          <Award className="w-5 h-5 text-yellow-600" />
          <h3 className="text-xl font-bold text-gray-900">Top 5 Performing Clients</h3>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={topClientsData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" stroke="#6b7280" />
            <YAxis stroke="#6b7280" />
            <Tooltip 
              contentStyle={{ backgroundColor: '#fff', border: '2px solid #e5e7eb', borderRadius: '8px' }}
            />
            <Legend />
            <Bar dataKey="deals" fill={COLORS.success} name="Deals" radius={[8, 8, 0, 0]} />
            <Bar dataKey="interviews" fill={COLORS.info} name="Interviews" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Account Health Summary */}
      {analyticsData?.summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="w-10 h-10 text-green-600" />
              <span className="text-3xl font-bold text-green-700">{analyticsData.summary.strong_accounts}</span>
            </div>
            <p className="text-sm font-semibold text-green-700 mb-1">Strong Accounts</p>
            <p className="text-xs text-green-600">High conversion, consistent performance</p>
            <div className="mt-3 h-2 bg-green-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-600 rounded-full" 
                style={{ width: `${(analyticsData.summary.strong_accounts / analyticsData.summary.total_clients) * 100}%` }}
              />
            </div>
          </div>

          <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-yellow-200 rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-10 h-10 text-yellow-600" />
              <span className="text-3xl font-bold text-yellow-700">{analyticsData.summary.average_accounts}</span>
            </div>
            <p className="text-sm font-semibold text-yellow-700 mb-1">Average Accounts</p>
            <p className="text-xs text-yellow-600">Moderate performance, needs attention</p>
            <div className="mt-3 h-2 bg-yellow-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-yellow-600 rounded-full" 
                style={{ width: `${(analyticsData.summary.average_accounts / analyticsData.summary.total_clients) * 100}%` }}
              />
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-rose-50 border-2 border-red-200 rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="w-10 h-10 text-red-600" />
              <span className="text-3xl font-bold text-red-700">{analyticsData.summary.at_risk_accounts}</span>
            </div>
            <p className="text-sm font-semibold text-red-700 mb-1">At Risk Accounts</p>
            <p className="text-xs text-red-600">Urgent action required</p>
            <div className="mt-3 h-2 bg-red-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-red-600 rounded-full" 
                style={{ width: `${(analyticsData.summary.at_risk_accounts / analyticsData.summary.total_clients) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Detailed Client Table */}
      <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-gray-600" />
            <h3 className="text-xl font-bold text-gray-900">Detailed Client Analytics</h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200 bg-gray-50">
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Client</th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-gray-700">Health</th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-gray-700">Roles</th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-gray-700">Interviews</th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-gray-700">Deals</th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-gray-700">
                  <Percent className="w-4 h-4 inline mr-1" />
                  Conversion
                </th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-gray-700">Issues</th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client: any) => {
                const totalIssues = client.on_hold_roles + client.no_answer_roles + client.cancelled_roles + client.lost_roles;
                
                return (
                  <tr key={client.client_id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-semibold text-gray-900">{client.client_name}</p>
                        <p className="text-xs text-gray-500 font-mono">{client.client_code}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                        client.health_tag === "Strong Account" 
                          ? "bg-green-100 text-green-700" 
                          : client.health_tag === "At Risk Account"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {client.health_tag === "Strong Account" && <CheckCircle className="w-3 h-3" />}
                        {client.health_tag === "At Risk Account" && <AlertTriangle className="w-3 h-3" />}
                        {client.health_tag === "Average Account" && <Clock className="w-3 h-3" />}
                        {client.health_score}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-center">
                        <p className="font-bold text-gray-900 text-lg">{client.total_roles}</p>
                        <p className="text-xs text-green-600">{client.active_roles} active</p>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-center">
                        <p className="font-bold text-gray-900 text-lg">{client.total_interviews}</p>
                        <div className="flex gap-1 justify-center mt-1">
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">L1:{client.interview_1_count}</span>
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">L2:{client.interview_2_count}</span>
                          <span className="text-xs bg-pink-100 text-pink-700 px-2 py-0.5 rounded">L3:{client.interview_3_count}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="inline-flex items-center gap-1 px-4 py-2 bg-green-100 text-green-700 rounded-full font-bold">
                        <CheckCircle className="w-4 h-4" />
                        {client.deal_roles}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="font-bold text-lg text-indigo-600">
                        {client.roles_to_deal_conversion.toFixed(1)}%
                      </div>
                      <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" 
                          style={{ width: `${Math.min(client.roles_to_deal_conversion, 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-center">
                        <p className={`font-bold text-lg ${
                          totalIssues > 10 ? 'text-red-600' : 
                          totalIssues > 5 ? 'text-yellow-600' : 'text-gray-600'
                        }`}>
                          {totalIssues}
                        </p>
                        <div className="text-xs text-gray-500 space-y-0.5 mt-1">
                          {client.lost_roles > 0 && <p className="text-red-600">Lost: {client.lost_roles}</p>}
                          {client.on_hold_roles > 0 && <p className="text-yellow-600">Hold: {client.on_hold_roles}</p>}
                          {client.no_answer_roles > 0 && <p className="text-orange-600">No Ans: {client.no_answer_roles}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <button
                        onClick={() => setSelectedClientDetails({
                          client_id: client.client_id,
                          client_name: client.client_name,
                          client_code: client.client_code,
                          total_roles: client.total_roles,
                          active_roles: client.active_roles,
                          interview_1: client.interview_1_count,
                          interview_2: client.interview_2_count,
                          interview_3: client.interview_3_count,
                          deals: client.deal_roles,
                          lost: client.lost_roles,
                          on_hold: client.on_hold_roles,
                          no_answer: client.no_answer_roles,
                          cancelled: client.cancelled_roles,
                          health: client.health_tag.replace(' Account', '')
                        })}
                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors inline-flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredClients.length === 0 && (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No client data available for the selected filters</p>
            </div>
          )}
        </div>
      </div>

      {/* Client Details Modal */}
      {selectedClientDetails && (
        <ClientDetailsModal
          client={selectedClientDetails}
          onClose={() => setSelectedClientDetails(null)}
        />
      )}

      {/* Performance Insights */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4 group cursor-help relative">
          <h4 className="font-bold text-blue-900 text-lg flex items-center gap-2">
            <Zap className="w-6 h-6" />
            Performance Insights
          </h4>
          <HelpCircle className="w-5 h-5 text-blue-400 hover:text-blue-600 transition-colors" />
          <div className="absolute left-0 top-full mt-2 w-96 bg-gray-900 text-white text-sm rounded-lg shadow-xl p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
            <div className="absolute -top-2 left-8 w-4 h-4 bg-gray-900 transform rotate-45"></div>
            <p className="font-semibold mb-2">Performance Insights</p>
            <p className="text-gray-300 leading-relaxed">
              AI-powered analysis identifying your strongest client relationships and areas requiring attention. Use these insights to prioritize your account management activities.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4 border border-blue-200 group cursor-help relative">
            <p className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Strong Points
            </p>
            <ul className="space-y-2 text-sm text-blue-800">
              {avgConversion > 20 && <li>• Excellent conversion rate ({avgConversion.toFixed(1)}%)</li>}
              {totalDeals > 10 && <li>• High deal volume ({totalDeals} closed deals)</li>}
              {analyticsData?.summary.strong_accounts > analyticsData?.summary.at_risk_accounts && 
                <li>• More strong accounts than at-risk accounts</li>
              }
              {totalInterviews > totalRoles * 2 && <li>• Strong interview engagement across roles</li>}
              {!avgConversion && !totalDeals && <li>• Building your track record</li>}
            </ul>
            <div className="absolute left-0 top-full mt-2 w-80 bg-gray-900 text-white text-sm rounded-lg shadow-xl p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <div className="absolute -top-2 left-4 w-4 h-4 bg-gray-900 transform rotate-45"></div>
              <p className="font-semibold mb-2">Your Strengths</p>
              <p className="text-gray-300 leading-relaxed">
                These are areas where you excel. Continue these successful practices and share them with team members. Your strong conversion rate indicates effective role management and client communication.
              </p>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-blue-200 group cursor-help relative">
            <p className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <Target className="w-4 h-4" />
              Areas for Improvement
            </p>
            <ul className="space-y-2 text-sm text-blue-800">
              {avgConversion < 15 && <li>• Focus on improving conversion rate (currently {avgConversion.toFixed(1)}%)</li>}
              {analyticsData?.summary.at_risk_accounts > 0 && 
                <li>• Address {analyticsData.summary.at_risk_accounts} at-risk account(s)</li>
              }
              {filteredClients.some((c: any) => c.no_answer_roles > 5) && 
                <li>• Follow up with clients showing low response rates</li>
              }
              {filteredClients.some((c: any) => c.lost_roles > c.deal_roles) && 
                <li>• Review processes for clients with high lost role counts</li>
              }
              {!avgConversion && !totalDeals && <li>• Start closing deals to build momentum</li>}
            </ul>
            <div className="absolute left-0 top-full mt-2 w-80 bg-gray-900 text-white text-sm rounded-lg shadow-xl p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <div className="absolute -top-2 left-4 w-4 h-4 bg-gray-900 transform rotate-45"></div>
              <p className="font-semibold mb-2">Growth Opportunities</p>
              <p className="text-gray-300 leading-relaxed">
                These areas need attention to improve your overall performance. Prioritize at-risk accounts and work on improving response rates from clients to maintain healthy relationships.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recommended Corrective Actions */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl shadow-lg border-2 border-indigo-200 p-6">
        <div className="flex items-center gap-3 mb-6 group cursor-help relative">
          <div className="w-12 h-12 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center">
            <Lightbulb className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">Recommended Corrective Actions</h3>
            <p className="text-sm text-slate-600">Strategic initiatives to optimize client performance</p>
          </div>
          <HelpCircle className="w-5 h-5 text-gray-400 hover:text-gray-600 transition-colors ml-auto" />
          <div className="absolute right-0 top-full mt-2 w-96 bg-gray-900 text-white text-sm rounded-lg shadow-xl p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
            <div className="absolute -top-2 right-8 w-4 h-4 bg-gray-900 transform rotate-45"></div>
            <p className="font-semibold mb-2">Action Plan</p>
            <p className="text-gray-300 leading-relaxed">
              Prioritized recommendations based on client health, conversion rates, and role performance. Focus on high-priority actions first for maximum impact.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {(() => {
            const actions = [];
            
            // At-risk clients
            const atRiskClients = filteredClients.filter((c: any) => c.health_tag === "At Risk Account");
            if (atRiskClients.length > 0) {
              atRiskClients.slice(0, 2).forEach((client: any) => {
                actions.push({
                  priority: 'high',
                  title: `Urgent: Restore ${client.client_name} Account Health`,
                  description: `Health score: ${client.health_score}. ${client.lost_roles} lost roles, ${client.no_answer_roles} no-response roles.`,
                  steps: [
                    `Schedule immediate face-to-face meeting with ${client.client_name} stakeholders`,
                    `Review all ${client.total_roles} roles - identify wins and pain points`,
                    `Present data-driven insights: ${client.total_interviews} interviews, ${client.deal_roles} deals`,
                    `Address ${client.no_answer_roles} unresponsive roles - get clear next steps`,
                    `Create 30-day action plan with weekly check-ins`,
                    `Consider assigning senior recruiter as dedicated point of contact`
                  ],
                  impact: `Save ${client.client_name} relationship and prevent account loss`
                });
              });
            }

            // Low overall conversion
            if (avgConversion < 15 && totalRoles > 5) {
              actions.push({
                priority: 'high',
                title: 'Improve Overall Conversion Rate',
                description: `Current rate: ${avgConversion.toFixed(1)}%. Industry target: 20-25%. Affecting all ${totalRoles} roles.`,
                steps: [
                  `Analyze top ${Math.ceil(filteredClients.length * 0.2)} performing clients - what's working?`,
                  'Implement weekly role pipeline review with recruitment team',
                  'Set conversion targets by client and track weekly progress',
                  'Improve candidate screening criteria before client submission',
                  'Enhance interview prep process for candidates',
                  'Speed up feedback loops between interviews'
                ],
                impact: `Increase conversion from ${avgConversion.toFixed(1)}% to 20%+, adding ${Math.round((0.20 - avgConversion/100) * totalRoles)} more deals`
              });
            }

            // No answer roles accumulating
            const highNoAnswerClients = filteredClients.filter((c: any) => c.no_answer_roles > 5);
            if (highNoAnswerClients.length > 0) {
              actions.push({
                priority: 'medium',
                title: 'Reduce Client Non-Response Rates',
                description: `${highNoAnswerClients.length} client(s) have 5+ unresponsive roles. Total: ${filteredClients.reduce((sum: number, c: any) => sum + c.no_answer_roles, 0)} no-answer roles.`,
                steps: [
                  `Priority clients: ${highNoAnswerClients.slice(0, 3).map((c: any) => c.client_name).join(', ')}`,
                  'Set up automated follow-up reminders for pending responses',
                  'Establish SLA expectations with clients for response times',
                  'Use multiple contact channels (email, phone, Slack/Teams)',
                  'Escalate to client executives if delays persist',
                  'Document and share unresponsive role outcomes with team'
                ],
                impact: 'Reduce no-answer roles by 50% and improve client engagement'
              });
            }

            // High lost roles
            const highLossClients = filteredClients.filter((c: any) => c.lost_roles > c.deal_roles && c.lost_roles > 2);
            if (highLossClients.length > 0) {
              actions.push({
                priority: 'high',
                title: 'Address High Role Loss Rate',
                description: `${highLossClients.length} client(s) losing more roles than closing. Pattern suggests process issues.`,
                steps: [
                  `Conduct post-mortem analysis on all lost roles`,
                  'Common reasons: unrealistic requirements, poor communication, budget misalignment?',
                  'Meet with each affected client to understand root causes',
                  'Adjust role intake process - set clearer expectations upfront',
                  'Implement qualification checklist before accepting new roles',
                  'Train recruiters on spotting red flags early'
                ],
                impact: 'Reduce lost roles by 40% and improve role success rate'
              });
            }

            // Low interview engagement
            if (totalInterviews < totalRoles && totalRoles > 10) {
              actions.push({
                priority: 'medium',
                title: 'Increase Interview Activity',
                description: `Only ${totalInterviews} interviews for ${totalRoles} roles (${(totalInterviews/totalRoles).toFixed(1)} per role). Target: 2-3 interviews per active role.`,
                steps: [
                  'Work with recruiters to increase submission quality and volume',
                  'Review role requirements - are they too restrictive?',
                  'Expand talent pool by considering adjacent skill sets',
                  'Speed up screening and submission processes',
                  'Set weekly submission targets per active role',
                  'Celebrate and learn from high-interview roles'
                ],
                impact: `Increase to ${Math.round(totalRoles * 2)} interviews, improving deal pipeline`
              });
            }

            // Strong performance - optimization
            if (actions.length === 0 && avgConversion >= 20) {
              actions.push({
                priority: 'low',
                title: 'Optimize High-Performing Account Management',
                description: `Excellent ${avgConversion.toFixed(1)}% conversion rate with ${totalDeals} closed deals.`,
                steps: [
                  'Document your successful client management playbook',
                  'Mentor other AMs - share what works',
                  'Explore expansion opportunities with strong clients',
                  'Consider taking on 1-2 strategic new accounts',
                  'Maintain current service levels while scaling',
                  'Set stretch goals: aim for 25%+ conversion rate'
                ],
                impact: 'Scale success across more clients and support team growth'
              });
            }

            // Default if no specific issues
            if (actions.length === 0) {
              actions.push({
                priority: 'medium',
                title: 'Build Consistent Performance Foundation',
                description: 'Establish strong account management practices.',
                steps: [
                  'Set up weekly client check-in schedule',
                  'Create role pipeline dashboards for visibility',
                  'Establish clear communication protocols with clients',
                  'Build relationships with hiring managers at each client',
                  'Track and improve key metrics: conversion, response time, satisfaction',
                  'Regularly review and update role requirements'
                ],
                impact: 'Build sustainable client relationships and predictable performance'
              });
            }

            return actions.map((action, index) => (
              <div key={index} className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border-2 ${
                        action.priority === 'high' ? 'bg-red-100 text-red-700 border-red-300' :
                        action.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                        'bg-blue-100 text-blue-700 border-blue-300'
                      }`}>
                        {action.priority} Priority
                      </span>
                    </div>
                    <h4 className="text-lg font-bold text-slate-800 mb-1">{action.title}</h4>
                    <p className="text-sm text-slate-600">{action.description}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <h5 className="text-sm font-bold text-slate-700 mb-2">Action Steps:</h5>
                  <ul className="space-y-2">
                    {action.steps.map((step, stepIndex) => (
                      <li key={stepIndex} className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-slate-700">{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-indigo-600" />
                    <span className="text-sm font-semibold text-indigo-800">Expected Impact:</span>
                  </div>
                  <p className="text-sm text-indigo-700 mt-1">{action.impact}</p>
                </div>
              </div>
            ));
          })()}
        </div>
      </div>
      <ReportDownloadModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        teams={teams}
        clients={clients}
        onDownload={handleReportDownload}
        allowedRoles={["account_manager"]}
      />
    </div>
  );
}
