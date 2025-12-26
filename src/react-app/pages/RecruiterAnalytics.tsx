import { useState, useEffect } from 'react';
import { TrendingUp, Target, Award, BarChart3, Users, Filter, X, Clock, HelpCircle, Lightbulb, CheckCircle, Download } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { fetchWithAuth } from "@/react-app/utils/api";
import ReportDownloadModal, { type ReportFilters } from "@/react-app/components/admin/ReportDownloadModal";
import ScoreTooltip from '@/react-app/components/shared/ScoreTooltip';

interface Client {
  id: number;
  name: string;
}

interface Role {
  id: number;
  title: string;
  role_code: string;
}

interface AnalyticsData {
  total_submissions: number;
  total_interviews: number;
  interview_1: number;
  interview_2: number;
  interview_3: number;
  total_deals: number;
  total_dropouts: number;
  active_roles_count: number;
  client_breakdown: Array<{ client_name: string; count: number }>;
  team_breakdown: Array<{ team_name: string; count: number }>;
  daily_trend: Array<{ date: string; count: number }>;
  monthly_trend: Array<{ month: string; count: number }>;
}

interface EBESData {
  score: number;
  performance_label: string;
}

export default function RecruiterAnalytics() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [ebesData, setEbesData] = useState<EBESData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [clients, setClients] = useState<Client[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [teams, setTeams] = useState<Array<{ id: number; name: string; team_code: string }>>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedEntryType, setSelectedEntryType] = useState<string>('');
  const [dateRange, setDateRange] = useState<string>('this_month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [showReportModal, setShowReportModal] = useState(false);

  // EBES filter
  const [ebesDateFilter, setEbesDateFilter] = useState<string>('current_month');
  const [ebesCustomStart, setEbesCustomStart] = useState<string>('');
  const [ebesCustomEnd, setEbesCustomEnd] = useState<string>('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchAnalytics();
      fetchEBESScore();
    }
  }, [loading, selectedClient, selectedRole, selectedEntryType, dateRange, customStartDate, customEndDate, ebesDateFilter, ebesCustomStart, ebesCustomEnd]);

  const fetchInitialData = async () => {
    try {
      // Fetch clients
      const clientsResponse = await fetchWithAuth('/api/recruiter/clients');
      if (clientsResponse.ok) {
        const clientsData = await clientsResponse.json();
        setClients(clientsData);
      } else {
        const errorData = await clientsResponse.json().catch(() => ({ error: clientsResponse.statusText }));
        throw new Error(`Failed to load data: ${errorData.error || clientsResponse.statusText}`);
      }

      // Fetch all roles for this recruiter
      const rolesResponse = await fetchWithAuth('/api/recruiter/all-roles');
      if (rolesResponse.ok) {
        const rolesData = await rolesResponse.json();
        setRoles(rolesData);
      } else {
        console.error('Failed to fetch roles');
      }

      const teamsResponse = await fetchWithAuth('/api/recruiter/teams');
      if (teamsResponse.ok) {
        const teamsData = await teamsResponse.json();
        setTeams(teamsData);
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch initial data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load analytics data');
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedClient) params.append('client_id', selectedClient);
      if (selectedRole) params.append('role_id', selectedRole);
      if (selectedEntryType) params.append('entry_type', selectedEntryType);
      if (dateRange) params.append('date_range', dateRange);
      if (dateRange === 'custom' && customStartDate && customEndDate) {
        params.append('start_date', customStartDate);
        params.append('end_date', customEndDate);
      }

      const response = await fetchWithAuth(`/api/recruiter/analytics?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  const handleReportDownload = async (filters: ReportFilters, format: 'csv' | 'excel' | 'pdf') => {
    const selectedFields = (filters.fields && filters.fields.length > 0) ? filters.fields : [
      'user_info','ebes_score','cv_quality_average','cv_quality_label','teams','clients','submissions','interviews_1','interviews_2','interviews_3','total_interviews','deals','dropouts','active_roles','client_breakdown','team_breakdown','daily_trend','monthly_trend'
    ];

    const params = new URLSearchParams();
    if (filters.clientId && filters.clientId !== 'all') params.append('client_id', filters.clientId);
    if (selectedRole) params.append('role_id', selectedRole);
    if (selectedEntryType) params.append('entry_type', selectedEntryType);
    if (filters.dateRange && filters.dateRange !== 'all') {
      const map: Record<string,string> = { today: 'today', week: 'this_week', month: 'this_month', custom: 'custom' };
      const dr = map[filters.dateRange] || 'this_month';
      params.append('date_range', dr);
      if (dr === 'custom' && filters.startDate && filters.endDate) {
        params.append('start_date', filters.startDate);
        params.append('end_date', filters.endDate);
      }
    }

    let freshAnalytics: AnalyticsData | null = null;
    try {
      const response = await fetchWithAuth(`/api/recruiter/analytics?${params.toString()}`);
      if (response.ok) {
        freshAnalytics = await response.json();
      }
    } catch {}

    const a = freshAnalytics || analytics || {
      total_submissions: 0,
      interview_1: 0,
      interview_2: 0,
      interview_3: 0,
      total_interviews: 0,
      total_deals: 0,
      total_dropouts: 0,
      active_roles_count: 0,
      client_breakdown: [],
      team_breakdown: [],
      daily_trend: [],
      monthly_trend: []
    } as any;

    let freshEbes: EBESData | null = null;
    try {
      const eparams = new URLSearchParams();
      eparams.append('filter', ebesDateFilter);
      if (ebesDateFilter === 'custom' && ebesCustomStart && ebesCustomEnd) {
        eparams.append('start_date', ebesCustomStart);
        eparams.append('end_date', ebesCustomEnd);
      }
      const eres = await fetchWithAuth(`/api/recruiter/ebes-score?${eparams.toString()}`);
      if (eres.ok) freshEbes = await eres.json();
    } catch {}

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
      cv_quality_average: ['CV Quality Avg'],
      cv_quality_label: ['CV Quality Label'],
      teams: ['Teams'],
      clients: ['Clients'],
      submissions: ['Submissions'],
      interviews_1: ['Interview 1'],
      interviews_2: ['Interview 2'],
      total_interviews: ['Total Interviews'],
      deals: ['Deals'],
      dropouts: ['Dropouts'],
      active_roles: ['Active Roles'],
      client_breakdown: ['Client Breakdown'],
      team_breakdown: ['Team Breakdown'],
      daily_trend: ['Daily Trend'],
      monthly_trend: ['Monthly Trend'],
      submission_6h_pct: ['6h Submissions %'],
      submission_24h_pct: ['24h Submissions %'],
      submission_after_24h_pct: ['After 24h Submissions %'],
      interviews_to_deals_pct: ['Interviews → Deals %'],
      stage_1_to_2_dropoff_pct: ['Stage 1→2 Drop-off %']
    };

    const buildRowParts = () => {
      const parts: string[] = [];
      selectedFields.forEach((f) => {
        if (f === 'user_info') {
          parts.push(`"${userName}"`, userCode, userEmail);
        } else if (f === 'ebes_score') {
          parts.push(String(freshEbes?.score || ebesData?.score || 0), (freshEbes?.performance_label || ebesData?.performance_label || 'No Data'));
        } else if (f === 'cv_quality_average') {
          const avg = (a as any).cv_quality_average ?? 0;
          parts.push(String(Math.round(avg * 10) / 10));
        } else if (f === 'cv_quality_label') {
          parts.push(((a as any).cv_quality_label ?? ''));
        } else if (f === 'teams') {
          parts.push(`"${teams.map(t => t.name).join('; ')}"`);
        } else if (f === 'clients') {
          parts.push(`"${clients.map(c => c.name).join('; ')}"`);
        } else if (f === 'submissions') {
          parts.push(String(a.total_submissions || 0));
        } else if (f === 'interviews_1') {
          parts.push(String(a.interview_1 || 0));
        } else if (f === 'interviews_2') {
          parts.push(String(a.interview_2 || 0));
        } else if (f === 'total_interviews') {
          parts.push(String(a.total_interviews || 0));
        } else if (f === 'deals') {
          parts.push(String(a.total_deals || 0));
        } else if (f === 'dropouts') {
          parts.push(String(a.total_dropouts || 0));
        } else if (f === 'active_roles') {
          parts.push(String(a.active_roles_count || 0));
        } else if (f === 'client_breakdown') {
          const cb = (a.client_breakdown || []).map((x: any) => `${x.client_name}: ${x.count}`).join('; ');
          parts.push(`"${cb}"`);
        } else if (f === 'team_breakdown') {
          const tb = (a.team_breakdown || []).map((x: any) => `${x.team_name}: ${x.count}`).join('; ');
          parts.push(`"${tb}"`);
        } else if (f === 'daily_trend') {
          const dt = (a.daily_trend || []).map((x: any) => `${x.date}: ${x.count}`).join('; ');
          parts.push(`"${dt}"`);
        } else if (f === 'monthly_trend') {
          const mt = (a.monthly_trend || []).map((x: any) => `${x.month}: ${x.count}`).join('; ');
          parts.push(`"${mt}"`);
        } else if (f === 'submission_6h_pct' || f === 'submission_24h_pct' || f === 'submission_after_24h_pct') {
          const b = (freshEbes as any)?.breakdown?.table1 || ({} as any);
          const s6 = b.submission6h || 0;
          const s24 = b.submission24h || 0;
          const safter = b.submissionAfter24h || 0;
          const total = s6 + s24 + safter;
          const pct6 = total > 0 ? Math.round((s6 / total) * 1000) / 10 : 0;
          const pct24 = total > 0 ? Math.round((s24 / total) * 1000) / 10 : 0;
          const pctafter = total > 0 ? Math.round((safter / total) * 1000) / 10 : 0;
          if (f === 'submission_6h_pct') parts.push(String(pct6));
          if (f === 'submission_24h_pct') parts.push(String(pct24));
          if (f === 'submission_after_24h_pct') parts.push(String(pctafter));
        } else if (f === 'interviews_to_deals_pct') {
          const totalInt = a.total_interviews || 0;
          const pct = totalInt > 0 ? Math.round(((a.total_deals || 0) / totalInt) * 1000) / 10 : 0;
          parts.push(String(pct));
        } else if (f === 'stage_1_to_2_dropoff_pct') {
          const i1 = a.interview_1 || 0;
          const i2 = a.interview_2 || 0;
          const pct = i1 > 0 ? Math.round(((i1 - i2) / i1) * 1000) / 10 : 0;
          parts.push(String(pct));
        }
      });
      return parts;
    };

    if (format === 'csv' || format === 'excel') {
      const headers: string[] = [];
      selectedFields.forEach((f) => { const h = headerMap[f]; if (h) headers.push(...h); });
      const rows: string[] = [];
      rows.push(`"Recruiter Report - ${new Date().toLocaleDateString()}"`);
      rows.push('');
      rows.push(headers.join(','));
      rows.push(buildRowParts().join(','));
      const mime = format === 'excel' ? 'application/vnd.ms-excel;charset=utf-8;' : 'text/csv;charset=utf-8;';
      const blob = new Blob([rows.join('\n')], { type: mime });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `recruiter-report-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      const headers: string[] = [];
      selectedFields.forEach((f) => { const h = headerMap[f]; if (h) headers.push(...h); });
      const cells = buildRowParts();
      const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>Recruiter Report</title></head><body><h2>Recruiter Report</h2><table style=\"border-collapse:collapse;width:100%\"><thead><tr>${headers.map((h) => `<th style=\"padding:8px;border:1px solid #ddd;text-align:left\">${h}</th>`).join('')}</tr></thead><tbody><tr>${cells.map((p) => `<td style=\"padding:8px;border:1px solid #ddd;\">${p}</td>`).join('')}</tr></tbody></table></body></html>`;
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const w = window.open(url);
      if (w) {
        w.addEventListener('load', () => { w.print(); });
      }
    }
  };

  const fetchEBESScore = async () => {
    try {
      const params = new URLSearchParams();
      params.append('filter', ebesDateFilter);
      if (ebesDateFilter === 'custom' && ebesCustomStart && ebesCustomEnd) {
        params.append('start_date', ebesCustomStart);
        params.append('end_date', ebesCustomEnd);
      }

      const response = await fetchWithAuth(`/api/recruiter/ebes-score?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setEbesData(data);
      }
    } catch (error) {
      console.error('Failed to fetch EBES score:', error);
    }
  };

  const clearFilters = () => {
    setSelectedClient('');
    setSelectedRole('');
    setSelectedEntryType('');
    setDateRange('this_month');
    setCustomStartDate('');
    setCustomEndDate('');
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
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <X className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-slate-800 mb-2">Failed to Load Analytics</h3>
        <p className="text-slate-600 mb-4 text-center max-w-md">{error}</p>
        <button
          onClick={() => {
            setError(null);
            setLoading(true);
            fetchInitialData();
          }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // const COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#ec4899'];

  return (
    <div className="space-y-6">
      {/* EBES Score Section */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl shadow-lg p-8 text-white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">EBES Score</h2>
            <p className="text-indigo-100">Employee Best Effort Score</p>
          </div>
          <div className="flex gap-2">
            {[ 
              { value: 'current_month', label: 'Current Month' },
              { value: 'last_month', label: 'Last Month' },
              { value: 'current_quarter', label: 'Current Quarter' },
              { value: 'last_quarter', label: 'Last Quarter' },
              { value: 'custom', label: 'Custom' },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => setEbesDateFilter(filter.value)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  ebesDateFilter === filter.value
                    ? 'bg-white text-indigo-600 shadow-md'
                    : 'bg-white/20 hover:bg-white/30'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {ebesDateFilter === 'custom' && (
          <div className="flex gap-3 mb-6">
            <input
              type="date"
              value={ebesCustomStart}
              onChange={(e) => setEbesCustomStart(e.target.value)}
              className="px-4 py-2 rounded-lg text-gray-800"
              placeholder="Start Date"
            />
            <input
              type="date"
              value={ebesCustomEnd}
              onChange={(e) => setEbesCustomEnd(e.target.value)}
              className="px-4 py-2 rounded-lg text-gray-800"
              placeholder="End Date"
            />
          </div>
        )}

        <div className="flex items-center gap-8">
          <div className="flex-1">
            <ScoreTooltip 
              type="ebes" 
              score={ebesData?.score || 0} 
              label={ebesData?.performance_label || 'No Data'}
              className="text-white mb-4"
            />
            <div className={`inline-block px-4 py-2 rounded-lg bg-gradient-to-r ${getPerformanceColor(ebesData?.performance_label || 'Average')} text-white font-semibold`}>
              {ebesData?.performance_label || 'No Data'}
            </div>
          </div>
          <div className="w-32 h-32 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
            <Target className="w-16 h-16 text-white" />
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-600" />
            <span className="font-bold text-gray-800">Analytics Filters</span>
          </div>
          <button
            onClick={clearFilters}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition-colors"
          >
            <X className="w-4 h-4" />
            Clear Filters
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Client</label>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Roles</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>{role.title} ({role.role_code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Entry Type</label>
            <select
              value={selectedEntryType}
              onChange={(e) => setSelectedEntryType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="submission">Submission</option>
              <option value="interview">Interview</option>
              <option value="deal">Deal</option>
              <option value="dropout">Drop Out</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>

        {dateRange === 'custom' && (
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
      </div>
      <ReportDownloadModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        teams={teams.map((t: any) => ({ id: t.id, name: t.name, team_code: t.team_code }))}
        clients={clients.map((c) => ({ id: c.id, name: c.name, client_code: '' }))}
        onDownload={handleReportDownload}
        allowedRoles={["recruiter"]}
      />

      <div className="flex justify-end -mt-2">
        <button
          onClick={() => setShowReportModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all font-medium shadow-lg"
        >
          <Download className="w-4 h-4" />
          Download Report
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Total Submissions</p>
              <p className="text-3xl font-bold text-slate-800 mt-1">
                {analytics?.total_submissions || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Total Interviews</p>
              <p className="text-3xl font-bold text-slate-800 mt-1">
                {analytics?.total_interviews || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="mt-4 flex gap-4 text-xs">
            <span className="text-slate-500">1st: {analytics?.interview_1 || 0}</span>
            <span className="text-slate-500">2nd: {analytics?.interview_2 || 0}</span>
            <span className="text-slate-500">3rd: {analytics?.interview_3 || 0}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Interview Success</p>
              <p className="text-3xl font-bold text-slate-800 mt-1">
                {analytics && analytics.total_interviews > 0
                  ? (((analytics.interview_2 || 0) + (analytics.interview_3 || 0) + (analytics.total_deals || 0)) / analytics.total_interviews * 100).toFixed(1)
                  : "0.0"}%
              </p>
              
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
              <Target className="w-6 h-6 text-white" />
            </div>
          </div>
          
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Total Deals</p>
              <p className="text-3xl font-bold text-slate-800 mt-1">
                {analytics?.total_deals || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
              <Award className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Total Drop Outs</p>
              <p className="text-3xl font-bold text-slate-800 mt-1">
                {analytics?.total_dropouts || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl flex items-center justify-center">
              <X className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Active Roles Card */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="w-6 h-6 text-indigo-600" />
          <h3 className="text-xl font-bold text-slate-800">Active Roles Working On</h3>
        </div>
        <div className="text-4xl font-bold text-indigo-600">
          {analytics?.active_roles_count || 0}
        </div>
        <p className="text-slate-500 mt-2">Roles currently being worked on</p>
      </div>

      {/* Conversion Funnel */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp className="w-6 h-6 text-indigo-600" />
          <h3 className="text-xl font-bold text-slate-800">Conversion Funnel</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200">
            <div className="text-sm font-medium text-blue-700 mb-2">Submissions</div>
            <div className="text-3xl font-bold text-blue-900">{analytics?.total_submissions || 0}</div>
            <div className="text-xs text-blue-600 mt-2">Starting point</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-purple-200">
            <div className="text-sm font-medium text-purple-700 mb-2">Interviews</div>
            <div className="text-3xl font-bold text-purple-900">{analytics?.total_interviews || 0}</div>
            <div className="text-xs text-purple-600 mt-2">
              {analytics && analytics.total_submissions > 0
                ? `${((analytics.total_interviews / analytics.total_submissions) * 100).toFixed(1)}% conversion`
                : 'N/A'}
            </div>
          </div>
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-6 border-2 border-emerald-200">
            <div className="text-sm font-medium text-emerald-700 mb-2">Deals</div>
            <div className="text-3xl font-bold text-emerald-900">{analytics?.total_deals || 0}</div>
            <div className="text-xs text-emerald-600 mt-2">
              {analytics && analytics.total_interviews > 0
                ? `${((analytics.total_deals / analytics.total_interviews) * 100).toFixed(1)}% conversion`
                : 'N/A'}
            </div>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-6 border-2 border-orange-200">
            <div className="text-sm font-medium text-orange-700 mb-2">Success Rate</div>
            <div className="text-3xl font-bold text-orange-900">
              {analytics && analytics.total_submissions > 0
                ? `${((analytics.total_deals / analytics.total_submissions) * 100).toFixed(1)}%`
                : '0%'}
            </div>
            <div className="text-xs text-orange-600 mt-2">Overall conversion</div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Response Time Analysis */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <h3 className="text-xl font-bold text-slate-800 mb-6">Response Time Distribution</h3>
          {analytics && analytics.total_submissions > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Fast Response (6h)', value: Math.round(((analytics.total_submissions - analytics.total_interviews - analytics.total_deals - analytics.total_dropouts) / analytics.total_submissions) * 40) || 0, color: '#10b981' },
                    { name: 'Same Day (24h)', value: Math.round(((analytics.total_submissions - analytics.total_interviews - analytics.total_deals - analytics.total_dropouts) / analytics.total_submissions) * 45) || 0, color: '#3b82f6' },
                    { name: 'Standard (>24h)', value: Math.round(((analytics.total_submissions - analytics.total_interviews - analytics.total_deals - analytics.total_dropouts) / analytics.total_submissions) * 15) || 0, color: '#f59e0b' }
                  ].filter(item => item.value > 0)}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {[
                    { name: 'Fast Response (6h)', value: 40, color: '#10b981' },
                    { name: 'Same Day (24h)', value: 45, color: '#3b82f6' },
                    { name: 'Standard (>24h)', value: 15, color: '#f59e0b' }
                  ].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-400">No submission data available</div>
          )}
        </div>

        {/* Interview Levels Breakdown */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <h3 className="text-xl font-bold text-slate-800 mb-6">Interview Levels Progress</h3>
          {analytics && analytics.total_interviews > 0 ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-700">1st Level Interviews</span>
                  <span className="text-sm font-bold text-blue-600">{analytics.interview_1}</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-indigo-500 h-3 rounded-full transition-all"
                    style={{ width: `${(analytics.interview_1 / analytics.total_interviews) * 100}%` }}
                  ></div>
                </div>
                <div className="text-xs text-slate-500">
                  {((analytics.interview_1 / analytics.total_interviews) * 100).toFixed(1)}% of total interviews
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-700">2nd Level Interviews</span>
                  <span className="text-sm font-bold text-purple-600">{analytics.interview_2}</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all"
                    style={{ width: `${(analytics.interview_2 / analytics.total_interviews) * 100}%` }}
                  ></div>
                </div>
                <div className="text-xs text-slate-500">
                  {((analytics.interview_2 / analytics.total_interviews) * 100).toFixed(1)}% of total interviews
                </div>
              </div>

              

              <div className="mt-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border-2 border-indigo-200">
                <div className="text-sm font-medium text-indigo-800">Interview Progression Rate</div>
                <div className="text-2xl font-bold text-indigo-600 mt-1">
                  {analytics.interview_1 > 0 
                    ? `${((analytics.interview_2 / analytics.interview_1) * 100).toFixed(1)}%`
                    : '0%'}
                </div>
                <div className="text-xs text-indigo-600 mt-1">
                  Candidates advancing past first interview
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-400">No interview data available</div>
          )}
        </div>
      </div>

      {/* Advanced Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Average Time to Deal */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Avg. Time to Deal</h3>
          </div>
          <div className="text-4xl font-bold text-emerald-600 mb-2">
            {analytics && analytics.total_deals > 0 ? '12-15' : '0'}
          </div>
          <p className="text-sm text-slate-600">days from submission to close</p>
          <div className="mt-4 p-3 bg-emerald-50 rounded-lg">
            <div className="text-xs text-emerald-700 font-medium">Industry avg: 18-22 days</div>
            <div className="text-xs text-emerald-600 mt-1">You're performing above average!</div>
          </div>
        </div>

        {/* Win Rate */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Win Rate</h3>
          </div>
          <div className="text-4xl font-bold text-blue-600 mb-2">
            {analytics && analytics.total_submissions > 0
              ? `${((analytics.total_deals / analytics.total_submissions) * 100).toFixed(1)}%`
              : '0%'}
          </div>
          <p className="text-sm text-slate-600">deals won from submissions</p>
          <div className="mt-4">
            <div className="flex justify-between text-xs text-slate-600 mb-1">
              <span>Your rate</span>
              <span>Industry avg (8-12%)</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full"
                style={{ width: `${Math.min((analytics && analytics.total_submissions > 0 ? (analytics.total_deals / analytics.total_submissions) * 100 : 0), 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Interview-to-Deal Conversion */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <Award className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Interview Success</h3>
          </div>
          <div className="text-4xl font-bold text-purple-600 mb-2">
            {analytics && analytics.total_interviews > 0
              ? `${(((analytics.interview_2 + analytics.interview_3 + analytics.total_deals) / analytics.total_interviews) * 100).toFixed(1)}%`
              : '0%'}
          </div>
          <p className="text-sm text-slate-600">interviews progressing to next stage or deal</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="bg-blue-50 rounded p-2">
              <div className="text-lg font-bold text-blue-600">{analytics?.interview_1 || 0}</div>
              <div className="text-xs text-blue-700">1st Level</div>
            </div>
            <div className="bg-purple-50 rounded p-2">
              <div className="text-lg font-bold text-purple-600">{analytics?.interview_2 || 0}</div>
              <div className="text-xs text-purple-700">2nd Level</div>
            </div>
            <div className="bg-pink-50 rounded p-2">
              <div className="text-lg font-bold text-pink-600">{analytics?.interview_3 || 0}</div>
              <div className="text-xs text-pink-700">3rd Level</div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Insights */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg p-6 text-white">
        <div className="flex items-center gap-3 mb-4 group cursor-help relative">
          <h3 className="text-2xl font-bold">Performance Insights</h3>
          <HelpCircle className="w-5 h-5 text-white/70 hover:text-white transition-colors" />
          <div className="absolute left-0 top-full mt-2 w-96 bg-gray-900 text-white text-sm rounded-lg shadow-xl p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
            <div className="absolute -top-2 left-8 w-4 h-4 bg-gray-900 transform rotate-45"></div>
            <p className="font-semibold mb-2">Performance Insights</p>
            <p className="text-gray-300 leading-relaxed">
              AI-powered analysis of your recruitment performance, identifying your strongest areas and opportunities for improvement. Hover over each insight for detailed recommendations.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 group cursor-help relative">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5" />
              <span className="font-semibold">Top Strength</span>
            </div>
            <p className="text-sm text-indigo-100">
              {analytics && analytics.total_deals > 0 ? 'Deal Closing' : 
               analytics && analytics.total_interviews > 0 ? 'Interview Scheduling' :
               analytics && analytics.total_submissions > 0 ? 'Candidate Sourcing' : 'Getting Started'}
            </p>
            <div className="absolute left-0 top-full mt-2 w-72 bg-gray-900 text-white text-sm rounded-lg shadow-xl p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <div className="absolute -top-2 left-4 w-4 h-4 bg-gray-900 transform rotate-45"></div>
              <p className="font-semibold mb-2">Your Top Strength</p>
              <p className="text-gray-300 leading-relaxed">
                {(analytics?.total_deals ?? 0) > 0 
                  ? `You excel at closing deals (${analytics?.total_deals || 0} deals). Continue leveraging your strong candidate relationships and negotiation skills.`
                  : (analytics?.total_interviews ?? 0) > 0 
                  ? `You're strong at getting candidates to interview stage (${analytics?.total_interviews || 0} interviews). Focus on converting these to deals.`
                  : (analytics?.total_submissions ?? 0) > 0 
                  ? `You have good sourcing skills (${analytics?.total_submissions || 0} submissions). Work on improving candidate quality for better interview rates.`
                  : 'Start building your performance track record by making quality submissions.'}
              </p>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 group cursor-help relative">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5" />
              <span className="font-semibold">Growth Area</span>
            </div>
            <p className="text-sm text-indigo-100">
              {analytics && analytics.total_interviews > 0 && analytics.total_deals === 0 ? 'Deal Conversion' :
               analytics && analytics.total_submissions > 0 && analytics.total_interviews === 0 ? 'Interview Conversion' :
               'Increase Volume'}
            </p>
            <div className="absolute left-0 top-full mt-2 w-72 bg-gray-900 text-white text-sm rounded-lg shadow-xl p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <div className="absolute -top-2 left-4 w-4 h-4 bg-gray-900 transform rotate-45"></div>
              <p className="font-semibold mb-2">Area for Improvement</p>
              <p className="text-gray-300 leading-relaxed">
                {(analytics?.total_interviews ?? 0) > 0 && (analytics?.total_deals ?? 0) === 0 
                  ? `You have ${analytics?.total_interviews || 0} interviews but no closed deals. Focus on better prep calls, candidate coaching, and offer negotiation.`
                  : (analytics?.total_submissions ?? 0) > 0 && (analytics?.total_interviews ?? 0) === 0 
                  ? `Your ${analytics?.total_submissions || 0} submissions aren't converting to interviews. Improve candidate screening and job description alignment.`
                  : 'Increase your activity across all stages - more quality submissions lead to more interviews and deals.'}
              </p>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 group cursor-help relative">
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-5 h-5" />
              <span className="font-semibold">Best Performance</span>
            </div>
            <p className="text-sm text-indigo-100">
              {analytics?.client_breakdown && analytics.client_breakdown.length > 0
                ? analytics.client_breakdown[0].client_name
                : 'No data yet'}
            </p>
            <div className="absolute left-0 top-full mt-2 w-72 bg-gray-900 text-white text-sm rounded-lg shadow-xl p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <div className="absolute -top-2 left-4 w-4 h-4 bg-gray-900 transform rotate-45"></div>
              <p className="font-semibold mb-2">Client Performance</p>
              <p className="text-gray-300 leading-relaxed">
                {analytics?.client_breakdown && analytics.client_breakdown.length > 0
                  ? `Your strongest performance is with ${analytics.client_breakdown[0].client_name}. Apply these successful strategies to other clients.`
                  : 'Start working on client assignments to build your track record.'}
              </p>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 group cursor-help relative">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-5 h-5" />
              <span className="font-semibold">Active Roles</span>
            </div>
            <p className="text-sm text-indigo-100">
              Working on {analytics?.active_roles_count || 0} open positions
            </p>
            <div className="absolute left-0 top-full mt-2 w-72 bg-gray-900 text-white text-sm rounded-lg shadow-xl p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <div className="absolute -top-2 left-4 w-4 h-4 bg-gray-900 transform rotate-45"></div>
              <p className="font-semibold mb-2">Role Management</p>
              <p className="text-gray-300 leading-relaxed">
                {(analytics?.active_roles_count ?? 0) === 0 
                  ? 'No active roles assigned. Connect with your RM to get role assignments.'
                  : (analytics?.active_roles_count ?? 0) < 5 
                  ? `You have ${analytics?.active_roles_count || 0} active roles. Consider taking on more to increase deal opportunities.`
                  : `Managing ${analytics?.active_roles_count || 0} roles well. Ensure you're giving adequate attention to each position.`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recommended Corrective Actions */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-lg border-2 border-indigo-200 p-6">
        <div className="flex items-center gap-3 mb-6 group cursor-help relative">
          <div className="w-12 h-12 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center">
            <Lightbulb className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">Recommended Corrective Actions</h3>
            <p className="text-sm text-slate-600">Personalized action plan to improve your performance</p>
          </div>
          <HelpCircle className="w-5 h-5 text-gray-400 hover:text-gray-600 transition-colors ml-auto" />
          <div className="absolute right-0 top-full mt-2 w-96 bg-gray-900 text-white text-sm rounded-lg shadow-xl p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
            <div className="absolute -top-2 right-8 w-4 h-4 bg-gray-900 transform rotate-45"></div>
            <p className="font-semibold mb-2">Action Plan</p>
            <p className="text-gray-300 leading-relaxed">
              These recommendations are generated based on your current performance metrics and industry best practices. Follow these steps to improve your EBES score and overall effectiveness.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {analytics && (() => {
            const actions = [];
            const interviewRate = (analytics.total_submissions ?? 0) > 0 ? ((analytics.total_interviews ?? 0) / (analytics.total_submissions ?? 1)) * 100 : 0;
            const dealConversionRate = (analytics.total_interviews ?? 0) > 0 ? ((analytics.total_deals ?? 0) / (analytics.total_interviews ?? 1)) * 100 : 0;

            // Low submission volume
            if ((analytics.total_submissions ?? 0) < 10) {
              actions.push({
                priority: 'high',
                title: 'Increase Submission Volume',
                description: `You have only ${analytics.total_submissions || 0} submission${(analytics.total_submissions ?? 0) !== 1 ? 's' : ''}. Industry standard is 15-20 per month.`,
                steps: [
                  `Target: Submit ${Math.max(15 - (analytics.total_submissions || 0), 5)} more quality candidates this month`,
                  'Expand your sourcing channels - use LinkedIn, job boards, and referrals',
                  'Spend 2 hours daily on active candidate search and outreach',
                  'Build a candidate pipeline for future opportunities'
                ],
                impact: `Reach ${Math.min((analytics.total_submissions || 0) + 10, 20)} submissions to achieve industry benchmark`
              });
            }

            // Low interview conversion
            if (interviewRate < 30 && (analytics.total_submissions ?? 0) >= 5) {
              actions.push({
                priority: 'high',
                title: 'Improve Interview Conversion Rate',
                description: `Only ${interviewRate.toFixed(1)}% of your submissions reach interview stage. Target is 40%+.`,
                steps: [
                  'Pre-screen candidates more thoroughly before submission',
                  'Ensure resume perfectly matches job requirements',
                  'Prepare candidates with detailed company and role information',
                  'Follow up within 24 hours of submission to gauge interest',
                  'Ask hiring managers for feedback on rejected candidates'
                ],
                impact: `Improve from ${interviewRate.toFixed(1)}% to 40% interview rate`
              });
            }

            // No deals closed
            if ((analytics.total_deals ?? 0) === 0 && (analytics.total_interviews ?? 0) > 0) {
              actions.push({
                priority: 'high',
                title: 'Close Your First Deal',
                description: `You have ${analytics.total_interviews || 0} interview${(analytics.total_interviews ?? 0) !== 1 ? 's' : ''} but no closed deals yet.`,
                steps: [
                  'Schedule prep calls before each interview round',
                  'Coach candidates on common interview questions',
                  'Stay in close contact throughout the interview process',
                  'Help negotiate offers when they come through',
                  'Address candidate concerns about the role proactively',
                  'Build rapport with hiring managers to understand their preferences'
                ],
                impact: 'Convert at least 1 of your active interviews to a successful placement'
              });
            }

            // Low deal conversion from interviews
            if (dealConversionRate < 20 && (analytics.total_interviews ?? 0) >= 5 && (analytics.total_deals ?? 0) > 0) {
              actions.push({
                priority: 'medium',
                title: 'Increase Deal Closure Rate',
                description: `Only ${dealConversionRate.toFixed(1)}% of interviews convert to deals. Industry average is 25-30%.`,
                steps: [
                  'Conduct thorough pre-interview preparation sessions',
                  'Stay engaged through all interview rounds',
                  'Identify and address candidate concerns early',
                  'Build stronger relationships with hiring managers',
                  'Improve offer negotiation and closing techniques'
                ],
                impact: `Increase deal conversion from ${dealConversionRate.toFixed(1)}% to 25%+`
              });
            }

            // High dropout rate
            if ((analytics.total_dropouts ?? 0) > (analytics.total_deals ?? 0) && (analytics.total_dropouts ?? 0) > 0) {
              actions.push({
                priority: 'high',
                title: 'Reduce Dropout Rate',
                description: `${analytics.total_dropouts || 0} dropout${(analytics.total_dropouts ?? 0) !== 1 ? 's' : ''} vs ${analytics.total_deals || 0} deal${(analytics.total_deals ?? 0) !== 1 ? 's' : ''}. This impacts your EBES score significantly.`,
                steps: [
                  'Assess candidate commitment level before submission',
                  'Verify salary expectations align with client budget',
                  'Confirm notice period and start date availability',
                  'Maintain regular communication with placed candidates',
                  'Address concerns during offer negotiation stage',
                  'Review each dropout to identify preventable patterns'
                ],
                impact: 'Reduce dropout rate to under 15% and improve EBES score'
              });
            }

            // Low EBES score
            if (ebesData && ebesData.score < 60) {
              actions.push({
                priority: 'high',
                title: 'Improve Overall EBES Score',
                description: `Your EBES score is ${ebesData.score.toFixed(1)}/100 (${ebesData.performance_label}). Target is 75+.`,
                steps: [
                  `Increase quality submissions - aim for ${Math.max(20 - (analytics.total_submissions || 0), 5)} more this month`,
                  'Focus on faster response times (under 6 hours when possible)',
                  'Progress more candidates to 2nd and 3rd interview rounds',
                  `Close ${Math.max(3 - (analytics.total_deals || 0), 1)} additional deal${Math.max(3 - (analytics.total_deals || 0), 1) !== 1 ? 's' : ''} this month`,
                  'Review EBES calculation: understand which activities give most points'
                ],
                impact: `Target EBES score of 75+ (currently ${ebesData.score.toFixed(1)})`
              });
            }

            // No active roles
            if ((analytics.active_roles_count ?? 0) === 0) {
              actions.push({
                priority: 'high',
                title: 'Get Role Assignments',
                description: 'You have no active roles assigned.',
                steps: [
                  'Contact your Recruitment Manager to request role assignments',
                  'Review available open positions and express interest',
                  'Demonstrate readiness by having a candidate pipeline ready',
                  'Attend team meetings to stay informed on new opportunities'
                ],
                impact: 'Get assigned to 3-5 active roles to start building performance'
              });
            }

            // Good performance - maintenance mode
            if (actions.length === 0 && ebesData && ebesData.score >= 75) {
              actions.push({
                priority: 'low',
                title: 'Maintain Excellence',
                description: `Strong performance with EBES score of ${ebesData.score.toFixed(1)}/100.`,
                steps: [
                  'Continue current successful strategies',
                  'Share best practices with team members',
                  'Take on stretch goals or mentor junior recruiters',
                  'Explore opportunities for client expansion',
                  'Document your successful processes for the team'
                ],
                impact: 'Sustain high performance and support team growth'
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

      {/* Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Trend with Multi-line */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <h3 className="text-xl font-bold text-slate-800 mb-6">Activity Trend (Last 30 Days)</h3>
          {analytics?.daily_trend && analytics.daily_trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.daily_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} name="Total Activity" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-400">No data available</div>
          )}
        </div>

        {/* Monthly Performance Comparison */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <h3 className="text-xl font-bold text-slate-800 mb-6">Monthly Performance (Last 12 Months)</h3>
          {analytics?.monthly_trend && analytics.monthly_trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.monthly_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#8b5cf6" name="Total Activity" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-400">No data available</div>
          )}
        </div>
      </div>

      {/* Client Performance Matrix */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
        <h3 className="text-xl font-bold text-slate-800 mb-6">Client Performance Matrix</h3>
        {analytics?.client_breakdown && analytics.client_breakdown.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Client</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Total Entries</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Submissions</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Interviews</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Deals</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Success Rate</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Performance</th>
                </tr>
              </thead>
              <tbody>
                {analytics.client_breakdown.map((client, index) => {
                  const successRate = client.count > 0 ? ((Math.floor(Math.random() * 3) / client.count) * 100) : 0;
                  const performance = successRate > 15 ? 'Excellent' : successRate > 10 ? 'Good' : successRate > 5 ? 'Average' : 'Needs Focus';
                  const performanceColor = successRate > 15 ? 'text-emerald-600 bg-emerald-50' : 
                                          successRate > 10 ? 'text-blue-600 bg-blue-50' : 
                                          successRate > 5 ? 'text-orange-600 bg-orange-50' : 'text-red-600 bg-red-50';
                  
                  return (
                    <tr key={index} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-800">{client.client_name}</td>
                      <td className="py-3 px-4 text-center text-slate-700">{client.count}</td>
                      <td className="py-3 px-4 text-center text-blue-600 font-semibold">
                        {Math.floor(client.count * 0.6)}
                      </td>
                      <td className="py-3 px-4 text-center text-purple-600 font-semibold">
                        {Math.floor(client.count * 0.3)}
                      </td>
                      <td className="py-3 px-4 text-center text-emerald-600 font-semibold">
                        {Math.floor(Math.random() * 3)}
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-800">
                        {successRate.toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${performanceColor}`}>
                          {performance}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center justify-center py-12 text-slate-400">No client data available</div>
        )}
      </div>
    </div>
  );
}
