import { useState, useEffect } from "react";
import {
  TrendingUp,
  Users,
  Target,
  Award,
  Filter,
  Search,
  UserCircle,
  Trophy,
  Medal,
  ChevronDown,
  ChevronUp,
  Download,
  TrendingDown,
  BarChart3,
  Activity,
  CheckCircle,
  HelpCircle,
  Lightbulb,
  Clock,
} from "lucide-react";
import { fetchWithAuth } from "@/react-app/utils/api";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import ReportDownloadModal, { type ReportFilters } from "./ReportDownloadModal";

interface UserStats {
  user_id: number;
  user_code: string;
  name: string;
  email: string;
  role: string;
  teams: { id: number; name: string; code: string }[];
  clients: { id: number; name: string; code: string }[];
  ebesScore: number;
  performanceLabel: string;
  // Recruiter specific
  totalSubmissions?: number;
  interviews1st?: number;
  interviews2nd?: number;
  interviews3rd?: number;
  totalInterviews?: number;
  deals?: number;
  dropouts?: number;
  activeRoles?: number;
  nonActiveRoles?: number;
  // Account Manager specific
  totalRoles?: number;
  dealsClosedRoles?: number;
  lostRoles?: number;
  onHoldRoles?: number;
  noAnswerRoles?: number;
  // Recruitment Manager specific
  managedTeams?: number;
  totalRecruiters?: number;
  totalDeals?: number;
}

const getRoleDisplayName = (role: string) => {
  switch (role) {
    case 'admin': return 'Admin';
    case 'recruiter': return 'Recruiter';
    case 'account_manager': return 'Account Manager';
    case 'recruitment_manager': return 'Recruitment Manager';
    default: return role;
  }
};

interface Leaderboards {
  recruiters: Array<{
    name: string;
    team: string;
    ebesScore: number;
    performanceLabel: string;
  }>;
  accountManagers: Array<{
    name: string;
    team: string;
    ebesScore: number;
    performanceLabel: string;
  }>;
  recruitmentManagers: Array<{
    name: string;
    team: string;
    ebesScore: number;
    performanceLabel: string;
  }>;
}

interface Team {
  id: number;
  name: string;
  team_code: string;
}

interface Client {
  id: number;
  name: string;
  client_code: string;
}

export default function PerformanceStats() {
  const [stats, setStats] = useState<UserStats[]>([]);
  const [leaderboards, setLeaderboards] = useState<Leaderboards | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [slaMetrics, setSlaMetrics] = useState<{ avg_days_open: number; roles_over_14: number; roles_over_30: number; avg_time_to_first_submission: number; avg_time_to_first_interview: number } | null>(null);
  const [slaRoles, setSlaRoles] = useState<Array<{ id: number; role_code: string; title: string; status: string; days_open: number; first_submission_days: number | null; first_interview_days: number | null; has_dropout: boolean; dropout_decision: string | null }>>([]);

  // Filters
  const [roleFilter, setRoleFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [performanceFilter, setPerformanceFilter] = useState("all");
  const [showCharts, setShowCharts] = useState(true);
  const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchStats();
  }, [roleFilter, searchTerm, teamFilter, clientFilter, dateRange, startDate, endDate]);

  useEffect(() => {
    fetchSLA();
  }, [teamFilter, clientFilter]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats();
      fetchSLA();
    }, 30000);
    return () => clearInterval(interval);
  }, [roleFilter, searchTerm, teamFilter, clientFilter, dateRange, startDate, endDate]);

  const fetchInitialData = async () => {
    try {
      const [teamsRes, clientsRes, leaderboardsRes] = await Promise.all([
        fetchWithAuth("/api/admin/teams"),
        fetchWithAuth("/api/admin/clients"),
        fetchWithAuth("/api/admin/leaderboards"),
      ]);

      if (teamsRes.ok && clientsRes.ok && leaderboardsRes.ok) {
        setTeams(await teamsRes.json());
        setClients(await clientsRes.json());
        setLeaderboards(await leaderboardsRes.json());
      }
    } catch (error) {
      console.error("Failed to fetch initial data:", error);
    }
  };

  

  const fetchStats = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (roleFilter !== "all") params.append("role", roleFilter);
      if (searchTerm) params.append("userName", searchTerm);
      if (teamFilter !== "all") params.append("teamId", teamFilter);
      if (clientFilter !== "all") params.append("clientId", clientFilter);

      if (dateRange === "custom" && startDate && endDate) {
        params.append("startDate", startDate);
        params.append("endDate", endDate);
      } else if (dateRange === "today") {
        const today = new Date().toISOString().split("T")[0];
        params.append("startDate", today);
        params.append("endDate", today);
      } else if (dateRange === "week") {
        const today = new Date();
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        params.append("startDate", weekAgo.toISOString().split("T")[0]);
        params.append("endDate", today.toISOString().split("T")[0]);
      } else if (dateRange === "month") {
        const today = new Date();
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        params.append("startDate", monthAgo.toISOString().split("T")[0]);
        params.append("endDate", today.toISOString().split("T")[0]);
      }

      const response = await fetchWithAuth(`/api/admin/performance-stats?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSLA = async () => {
    try {
      const params = new URLSearchParams();
      if (teamFilter !== "all") params.append("team_id", teamFilter);
      if (clientFilter !== "all") params.append("client_id", clientFilter);
      params.append("status", "active");
      const res = await fetchWithAuth(`/api/admin/sla?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSlaMetrics(data.metrics);
        setSlaRoles(data.roles);
      }
    } catch (error) {
      console.error("Failed to fetch admin SLA metrics:", error);
    }
  };

  const getCorrectiveActions = (user: UserStats): string[] => {
    const actions: string[] = [];
    const subs = user.totalSubmissions || 0;
    const i1 = user.interviews1st || 0;
    const i2 = user.interviews2nd || 0;
    const totalInts = user.totalInterviews || (i1 + i2);
    const deals = (user.deals || 0) + (user.dealsClosedRoles || 0);
    const lost = user.lostRoles || 0;
    const onHold = user.onHoldRoles || 0;
    const noAns = user.noAnswerRoles || 0;
    const dropouts = user.dropouts || 0;

    if (dropouts > 0) {
      actions.push('Reduce dropouts with stronger qualification and preparation');
      actions.push('Tighten feedback cadence with hiring managers');
    }
    if (subs > 0 && i1 / subs < 0.2) {
      actions.push('Increase CV match quality and role-specific tailoring');
    }
    if (i1 > 0 && i2 / i1 < 0.5) {
      actions.push('Improve candidate coaching between rounds');
    }
    if (totalInts > 0 && deals / totalInts < 0.1) {
      actions.push('Strengthen closing strategy and decision timelines');
    }
    if (lost > 0) {
      actions.push('Analyze lost roles for preventable patterns and better fit');
    }
    if (noAns > 0) {
      actions.push('Shorten feedback loops and escalate slow responses');
    }
    if (onHold > 0) {
      actions.push('Re-qualify on-hold roles and reset expectations');
    }
    if (actions.length === 0) {
      actions.push('Maintain current best practices and monitor conversions');
    }
    return actions;
  };

  const getPerformanceColor = (label: string) => {
    switch (label) {
      case "Excellent":
        return "text-green-700 bg-green-100";
      case "Good":
        return "text-blue-700 bg-blue-100";
      case "Average":
        return "text-yellow-700 bg-yellow-100";
      case "Needs Improvement":
        return "text-orange-700 bg-orange-100";
      default:
        return "text-gray-700 bg-gray-100";
    }
  };

  

  const totalUsers = stats.length;
  const avgEbesScore =
    stats.length > 0 ? stats.reduce((sum, s) => sum + s.ebesScore, 0) / stats.length : 0;

  const totalSubmissions = stats.reduce((sum, s) => sum + (s.totalSubmissions || 0), 0);
  const totalDeals = stats.reduce(
    (sum, s) => sum + (s.deals || 0) + (s.dealsClosedRoles || 0) + (s.totalDeals || 0),
    0
  );

const generatePDFReport = (data: UserStats[], fields: string[]) => {
  const headerMap: Record<string, string[]> = {
    user_info: ['Name','User Code','Email','Role'],
    ebes_score: ['EBES Score','Performance'],
    teams: ['Teams'],
    clients: ['Clients'],
    total_roles: ['Total Roles'],
    active_roles: ['Active Roles'],
    non_active_roles: ['Non-Active Roles'],
    submissions: ['Submissions'],
    interviews_1: ['Interview 1'],
    interviews_2: ['Interview 2'],
    total_interviews: ['Total Interviews'],
    deals: ['Deals'],
    dropouts: ['Dropouts'],
    lost_roles: ['Lost Roles'],
    on_hold_roles: ['On Hold Roles'],
    no_answer_roles: ['No Answer Roles'],
    managed_teams: ['Teams Managed'],
    total_recruiters: ['Recruiters']
  };
  const headers: string[] = [];
  fields.forEach((f) => {
    const h = headerMap[f];
    if (h) headers.push(...h);
  });
  const rows = data.map((user) => {
    const parts: string[] = [];
    fields.forEach((f) => {
      if (f === 'user_info') {
        parts.push(user.name, user.user_code, user.email, getRoleDisplayName(user.role));
      } else if (f === 'ebes_score') {
        parts.push(String(user.ebesScore), user.performanceLabel);
      } else if (f === 'teams') {
        parts.push(user.teams.map((t) => t.name).join(', '));
      } else if (f === 'clients') {
        parts.push(user.clients.map((c) => c.name).join(', '));
      } else if (f === 'total_roles') {
        parts.push(String(user.totalRoles || 0));
      } else if (f === 'active_roles') {
        parts.push(String(user.activeRoles || 0));
      } else if (f === 'non_active_roles') {
        parts.push(String(user.nonActiveRoles || 0));
      } else if (f === 'submissions') {
        parts.push(String(user.totalSubmissions || 0));
      } else if (f === 'interviews_1') {
        parts.push(String(user.interviews1st || 0));
      } else if (f === 'interviews_2') {
        parts.push(String(user.interviews2nd || 0));
      } else if (f === 'total_interviews') {
        parts.push(String(user.totalInterviews || 0));
      } else if (f === 'deals') {
        parts.push(String((user.deals || 0) + (user.dealsClosedRoles || 0)));
      } else if (f === 'dropouts') {
        parts.push(String(user.dropouts || 0));
      } else if (f === 'lost_roles') {
        parts.push(String(user.lostRoles || 0));
      } else if (f === 'on_hold_roles') {
        parts.push(String(user.onHoldRoles || 0));
      } else if (f === 'no_answer_roles') {
        parts.push(String(user.noAnswerRoles || 0));
      } else if (f === 'managed_teams') {
        parts.push(String(user.managedTeams || 0));
      } else if (f === 'total_recruiters') {
        parts.push(String(user.totalRecruiters || 0));
      }
    });
    return `<tr>${parts.map((p) => `<td style="padding:8px;border:1px solid #ddd;">${p}</td>`).join('')}</tr>`;
  }).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>EBES Report</title></head><body><h2>EBES Performance Report</h2><table style="border-collapse:collapse;width:100%"><thead><tr>${headers.map((h) => `<th style=\"padding:8px;border:1px solid #ddd;text-align:left\">${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const w = window.open(url);
  if (w) {
    w.addEventListener('load', () => {
      w.print();
    });
  }
};
  const totalInterviews = stats.reduce(
    (sum, s) => sum + (s.totalInterviews || 0),
    0
  );
  const totalDropouts = stats.reduce((sum, s) => sum + (s.dropouts || 0), 0);

  const handleReportDownload = async (filters: ReportFilters, format: 'csv' | 'excel' | 'pdf') => {
    try {
      // Fetch data with filters
      const params = new URLSearchParams();
      if (filters.role !== "all") params.append("role", filters.role);
      if (filters.searchTerm) params.append("userName", filters.searchTerm);
      if (filters.teamId !== "all") params.append("teamId", filters.teamId);
      if (filters.clientId !== "all") params.append("clientId", filters.clientId);

      if (filters.dateRange === "custom" && filters.startDate && filters.endDate) {
        params.append("startDate", filters.startDate);
        params.append("endDate", filters.endDate);
      } else if (filters.dateRange === "today") {
        const today = new Date().toISOString().split("T")[0];
        params.append("startDate", today);
        params.append("endDate", today);
      } else if (filters.dateRange === "week") {
        const today = new Date();
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        params.append("startDate", weekAgo.toISOString().split("T")[0]);
        params.append("endDate", today.toISOString().split("T")[0]);
      } else if (filters.dateRange === "month") {
        const today = new Date();
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        params.append("startDate", monthAgo.toISOString().split("T")[0]);
        params.append("endDate", today.toISOString().split("T")[0]);
      }

      const response = await fetchWithAuth(`/api/admin/performance-stats?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch data");
      
      const data: UserStats[] = await response.json();
      
      // Filter by performance level
      const filteredData = filters.performanceLevel !== "all" 
        ? data.filter(u => u.performanceLabel === filters.performanceLevel)
        : data;

      const selectedFields = (filters.fields && filters.fields.length > 0) ? filters.fields : [
        'user_info','ebes_score','teams','clients','total_roles','active_roles','non_active_roles','submissions','interviews_1','interviews_2','total_interviews','deals','dropouts','lost_roles','on_hold_roles','no_answer_roles','managed_teams','total_recruiters'
      ];
      if (format === 'csv') {
        generateCSVReport(filteredData, selectedFields);
      } else if (format === 'excel') {
        generateExcelReport(filteredData, selectedFields);
      } else {
        generatePDFReport(filteredData, selectedFields);
      }
    } catch (error) {
      console.error("Failed to download report:", error);
      alert("Failed to download report. Please try again.");
    }
  };

  const generateCSVReport = (data: UserStats[], fields: string[]) => {
    const csvRows = [];
    const headerMap: Record<string, string[]> = {
      user_info: ['Name','User Code','Email','Role'],
      ebes_score: ['EBES Score','Performance Level'],
      teams: ['Teams'],
      clients: ['Clients'],
      total_roles: ['Total Roles'],
      active_roles: ['Active Roles'],
      non_active_roles: ['Non-Active Roles'],
      submissions: ['Submissions'],
      interviews_1: ['Interview Round 1'],
      interviews_2: ['Interview Round 2'],
      interviews_3: ['Interview Round 3'],
      total_interviews: ['Total Interviews'],
      deals: ['Deals'],
      dropouts: ['Dropouts'],
      lost_roles: ['Lost Roles'],
      on_hold_roles: ['On Hold Roles'],
      no_answer_roles: ['No Answer Roles'],
      managed_teams: ['Teams Managed'],
      total_recruiters: ['Recruiters']
    };
    const headers: string[] = [];
    fields.forEach((f) => {
      const h = headerMap[f];
      if (h) headers.push(...h);
    });
    csvRows.push(headers.join(','));

    // Data rows
    data.forEach((user) => {
      const parts: string[] = [];
      fields.forEach((f) => {
        if (f === 'user_info') {
          parts.push(`"${user.name}"`, user.user_code, user.email, getRoleDisplayName(user.role));
        } else if (f === 'ebes_score') {
          parts.push(String(user.ebesScore), user.performanceLabel);
        } else if (f === 'teams') {
          parts.push(`"${user.teams.map((t) => t.name).join('; ')}"`);
        } else if (f === 'clients') {
          parts.push(`"${user.clients.map((c) => c.name).join('; ')}"`);
        } else if (f === 'total_roles') {
          parts.push(String(user.totalRoles || 0));
        } else if (f === 'active_roles') {
          parts.push(String(user.activeRoles || 0));
        } else if (f === 'non_active_roles') {
          parts.push(String(user.nonActiveRoles || 0));
        } else if (f === 'submissions') {
          parts.push(String(user.totalSubmissions || 0));
        } else if (f === 'interviews_1') {
          parts.push(String(user.interviews1st || 0));
        } else if (f === 'interviews_2') {
          parts.push(String(user.interviews2nd || 0));
        } else if (f === 'interviews_3') {
          parts.push(String(user.interviews3rd || 0));
        } else if (f === 'total_interviews') {
          parts.push(String(user.totalInterviews || 0));
        } else if (f === 'deals') {
          parts.push(String((user.deals || 0) + (user.dealsClosedRoles || 0)));
        } else if (f === 'dropouts') {
          parts.push(String(user.dropouts || 0));
        } else if (f === 'lost_roles') {
          parts.push(String(user.lostRoles || 0));
        } else if (f === 'on_hold_roles') {
          parts.push(String(user.onHoldRoles || 0));
        } else if (f === 'no_answer_roles') {
          parts.push(String(user.noAnswerRoles || 0));
        } else if (f === 'managed_teams') {
          parts.push(String(user.managedTeams || 0));
        } else if (f === 'total_recruiters') {
          parts.push(String(user.totalRecruiters || 0));
        }
      });
      csvRows.push(parts.join(','));
    });

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ebes-performance-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const generateExcelReport = (data: UserStats[], fields: string[]) => {
    // For Excel format, we'll create a more structured CSV that Excel can open nicely
    // In a production app, you'd use a library like xlsx or exceljs
    const csvRows = [];
    
    // Title row
    csvRows.push(`"EBES Performance Report - Generated on ${new Date().toLocaleDateString()}"`);
    csvRows.push(""); // Empty row
    
    // Summary statistics
    const totalUsers = data.length;
    const avgScore = data.length > 0 ? data.reduce((sum, u) => sum + u.ebesScore, 0) / data.length : 0;
    const totalSubs = data.reduce((sum, u) => sum + (u.totalSubmissions || 0), 0);
    const totalInts = data.reduce((sum, u) => sum + (u.totalInterviews || 0), 0);
    const totalDealsCount = data.reduce((sum, u) => sum + (u.deals || 0) + (u.dealsClosedRoles || 0) + (u.totalDeals || 0), 0);
    
    csvRows.push("Summary Statistics");
    csvRows.push(`Total Users,${totalUsers}`);
    csvRows.push(`Average EBES Score,${avgScore.toFixed(2)}`);
    csvRows.push(`Total Submissions,${totalSubs}`);
    csvRows.push(`Total Interviews,${totalInts}`);
    csvRows.push(`Total Deals,${totalDealsCount}`);
    csvRows.push(""); // Empty row
    
    const headerMap: Record<string, string[]> = {
      user_info: ['Name','User Code','Email','Role'],
      ebes_score: ['EBES Score','Performance'],
      teams: ['Teams'],
      clients: ['Clients'],
      total_roles: ['Total Roles'],
      active_roles: ['Active Roles'],
      submissions: ['Submissions'],
      interviews_1: ['Interview 1'],
      interviews_2: ['Interview 2'],
      interviews_3: ['Interview 3'],
      total_interviews: ['Total Interviews'],
      deals: ['Deals'],
      dropouts: ['Dropouts'],
      lost_roles: ['Lost'],
      on_hold_roles: ['On Hold'],
      no_answer_roles: ['No Answer']
    };
    const headers: string[] = [];
    fields.forEach((f) => {
      const h = headerMap[f];
      if (h) headers.push(...h);
    });
    csvRows.push(headers.join(','));

    // Data rows
    data.forEach((user) => {
      const parts: string[] = [];
      fields.forEach((f) => {
        if (f === 'user_info') {
          parts.push(`"${user.name}"`, user.user_code, user.email, getRoleDisplayName(user.role));
        } else if (f === 'ebes_score') {
          parts.push(String(user.ebesScore), user.performanceLabel);
        } else if (f === 'teams') {
          parts.push(`"${user.teams.map((t) => t.name).join('; ')}"`);
        } else if (f === 'clients') {
          parts.push(`"${user.clients.map((c) => c.name).join('; ')}"`);
        } else if (f === 'total_roles') {
          parts.push(String(user.totalRoles || 0));
        } else if (f === 'active_roles') {
          parts.push(String(user.activeRoles || 0));
        } else if (f === 'submissions') {
          parts.push(String(user.totalSubmissions || 0));
        } else if (f === 'interviews_1') {
          parts.push(String(user.interviews1st || 0));
        } else if (f === 'interviews_2') {
          parts.push(String(user.interviews2nd || 0));
        } else if (f === 'interviews_3') {
          parts.push(String(user.interviews3rd || 0));
        } else if (f === 'total_interviews') {
          parts.push(String(user.totalInterviews || 0));
        } else if (f === 'deals') {
          parts.push(String((user.deals || 0) + (user.dealsClosedRoles || 0)));
        } else if (f === 'dropouts') {
          parts.push(String(user.dropouts || 0));
        } else if (f === 'lost_roles') {
          parts.push(String(user.lostRoles || 0));
        } else if (f === 'on_hold_roles') {
          parts.push(String(user.onHoldRoles || 0));
        } else if (f === 'no_answer_roles') {
          parts.push(String(user.noAnswerRoles || 0));
        }
      });
      csvRows.push(parts.join(','));
    });

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ebes-performance-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  

  // Calculate role distribution
  const roleDistribution = [
    { name: 'Recruiters', value: stats.filter(s => s.role === 'recruiter').length, color: '#3b82f6' },
    { name: 'Account Managers', value: stats.filter(s => s.role === 'account_manager').length, color: '#8b5cf6' },
    { name: 'Recruitment Managers', value: stats.filter(s => s.role === 'recruitment_manager').length, color: '#10b981' },
    { name: 'Admins', value: stats.filter(s => s.role === 'admin').length, color: '#f59e0b' },
  ].filter(d => d.value > 0);

  // Calculate performance distribution
  const performanceDistribution = [
    { name: 'Excellent', value: stats.filter(s => s.performanceLabel === 'Excellent').length, color: '#10b981' },
    { name: 'Good', value: stats.filter(s => s.performanceLabel === 'Good').length, color: '#3b82f6' },
    { name: 'Average', value: stats.filter(s => s.performanceLabel === 'Average').length, color: '#f59e0b' },
    { name: 'Needs Improvement', value: stats.filter(s => s.performanceLabel === 'Needs Improvement').length, color: '#ef4444' },
  ].filter(d => d.value > 0);

  // Calculate EBES trends by role
  const ebesByRole = [
    {
      role: 'Recruiters',
      avgScore: stats.filter(s => s.role === 'recruiter').reduce((sum, s) => sum + s.ebesScore, 0) / Math.max(stats.filter(s => s.role === 'recruiter').length, 1),
      count: stats.filter(s => s.role === 'recruiter').length,
    },
    {
      role: 'Account Managers',
      avgScore: stats.filter(s => s.role === 'account_manager').reduce((sum, s) => sum + s.ebesScore, 0) / Math.max(stats.filter(s => s.role === 'account_manager').length, 1),
      count: stats.filter(s => s.role === 'account_manager').length,
    },
    {
      role: 'Recruitment Managers',
      avgScore: stats.filter(s => s.role === 'recruitment_manager').reduce((sum, s) => sum + s.ebesScore, 0) / Math.max(stats.filter(s => s.role === 'recruitment_manager').length, 1),
      count: stats.filter(s => s.role === 'recruitment_manager').length,
    },
  ].filter(r => r.count > 0);

  // Filter stats by performance level
  const filteredStats = performanceFilter === "all" 
    ? stats 
    : stats.filter(s => s.performanceLabel === performanceFilter);

  return (
    <div className="space-y-6">
      <ReportDownloadModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        teams={teams}
        clients={clients}
        onDownload={handleReportDownload}
        allowedRoles={["admin","account_manager","recruitment_manager","recruiter"]}
      />
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Performance Statistics</h2>
          <p className="text-gray-600 mt-1">Comprehensive performance metrics for all users</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCharts(!showCharts)}
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-200 text-gray-700 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-all"
          >
            <BarChart3 className="w-4 h-4" />
            {showCharts ? 'Hide' : 'Show'} Charts
          </button>
          <button
            onClick={() => setShowReportModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg transition-all shadow-lg"
          >
            <Download className="w-4 h-4" />
            Download Report
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Award className="w-8 h-8 opacity-80" />
            <span className="text-2xl font-bold">{avgEbesScore.toFixed(1)}</span>
          </div>
          <p className="text-indigo-100 text-sm font-medium">Avg EBES Score</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 opacity-80" />
            <span className="text-2xl font-bold">{totalUsers}</span>
          </div>
          <p className="text-blue-100 text-sm font-medium">Total Users</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Target className="w-8 h-8 opacity-80" />
            <span className="text-2xl font-bold">{totalSubmissions}</span>
          </div>
          <p className="text-purple-100 text-sm font-medium">Total Submissions</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-8 h-8 opacity-80" />
            <span className="text-2xl font-bold">{totalDeals}</span>
          </div>
          <p className="text-green-100 text-sm font-medium">Total Deals</p>
        </div>
      </div>

      {/* Additional Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-lg border-2 border-blue-100">
          <div className="flex items-center justify-between mb-2">
            <Activity className="w-8 h-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">{totalInterviews}</span>
          </div>
          <p className="text-gray-600 text-sm font-medium">Total Interviews</p>
          <div className="mt-2 text-xs text-gray-500">
            {totalSubmissions > 0 && `${((totalInterviews / totalSubmissions) * 100).toFixed(1)}% conversion rate`}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg border-2 border-yellow-100">
          <div className="flex items-center justify-between mb-2">
            <TrendingDown className="w-8 h-8 text-yellow-600" />
            <span className="text-2xl font-bold text-gray-900">{totalDropouts}</span>
          </div>
          <p className="text-gray-600 text-sm font-medium">Total Dropouts</p>
          <div className="mt-2 text-xs text-gray-500">
            {totalDeals > 0 && `${((totalDropouts / (totalDeals + totalDropouts)) * 100).toFixed(1)}% dropout rate`}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg border-2 border-green-100">
          <div className="flex items-center justify-between mb-2">
            <Target className="w-8 h-8 text-green-600" />
            <span className="text-2xl font-bold text-gray-900">
              {totalInterviews > 0 ? (((stats.reduce((sum, s) => sum + (s.interviews2nd || 0) + (s.interviews3rd || 0), 0) + totalDeals) / totalInterviews) * 100).toFixed(1) : 0}%
            </span>
          </div>
          <p className="text-gray-600 text-sm font-medium">Interview Success</p>
          
        </div>
      </div>

      {/* Charts Section */}
      {showCharts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Role Distribution */}
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-6">
              <Users className="w-5 h-5 text-indigo-600" />
              <h3 className="text-xl font-bold text-gray-900">User Distribution by Role</h3>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={roleDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {roleDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Performance Distribution */}
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-6">
              <Award className="w-5 h-5 text-purple-600" />
              <h3 className="text-xl font-bold text-gray-900">Performance Distribution</h3>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={performanceDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {performanceDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Average EBES by Role */}
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <h3 className="text-xl font-bold text-gray-900">Average EBES Score by Role</h3>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ebesByRole}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="role" stroke="#6b7280" tick={{ fontSize: 12 }} />
                <YAxis stroke="#6b7280" domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '2px solid #e5e7eb', borderRadius: '8px' }}
                />
                <Bar dataKey="avgScore" fill="#6366f1" name="Average EBES Score" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Performance Metrics Comparison */}
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <h3 className="text-xl font-bold text-gray-900">Key Performance Metrics</h3>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Submission to Interview</span>
                  <span className="text-sm font-bold text-blue-600">
                    {totalSubmissions > 0 ? ((totalInterviews / totalSubmissions) * 100).toFixed(1) : 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-indigo-500 h-3 rounded-full transition-all"
                    style={{ width: `${Math.min((totalSubmissions > 0 ? (totalInterviews / totalSubmissions) * 100 : 0), 100)}%` }}
                  ></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Interview Success</span>
                  <span className="text-sm font-bold text-green-600">
                    {totalInterviews > 0 ? (((stats.reduce((sum, s) => sum + (s.interviews2nd || 0) + (s.interviews3rd || 0), 0) + totalDeals) / totalInterviews) * 100).toFixed(1) : 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-green-500 to-emerald-500 h-3 rounded-full transition-all"
                    style={{ width: `${Math.min((totalInterviews > 0 ? ((stats.reduce((sum, s) => sum + (s.interviews2nd || 0) + (s.interviews3rd || 0), 0) + totalDeals) / totalInterviews) * 100 : 0), 100)}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Overall Win Rate</span>
                  <span className="text-sm font-bold text-purple-600">
                    {totalSubmissions > 0 ? ((totalDeals / totalSubmissions) * 100).toFixed(1) : 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all"
                    style={{ width: `${Math.min((totalSubmissions > 0 ? (totalDeals / totalSubmissions) * 100 : 0), 100)}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Retention Rate</span>
                  <span className="text-sm font-bold text-indigo-600">
                    {(totalDeals + totalDropouts) > 0 ? ((totalDeals / (totalDeals + totalDropouts)) * 100).toFixed(1) : 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 to-blue-500 h-3 rounded-full transition-all"
                    style={{ width: `${Math.min(((totalDeals + totalDropouts) > 0 ? (totalDeals / (totalDeals + totalDropouts)) * 100 : 0), 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Role Aging & SLA */}
      {slaMetrics && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Role Aging & SLA (Org)
                </h2>
                <p className="text-sm text-slate-600 mt-1">Organization-wide role aging and responsiveness</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs text-slate-500 mb-1">Avg Days Open</div>
                <div className="text-2xl font-bold text-slate-800">{slaMetrics.avg_days_open}</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <div className="text-xs text-red-600 mb-1">Roles ≥14d</div>
                <div className="text-2xl font-bold text-red-700">{slaMetrics.roles_over_14}</div>
              </div>
              <div className="bg-red-100 rounded-lg p-3">
                <div className="text-xs text-red-700 mb-1">Roles ≥30d</div>
                <div className="text-2xl font-bold text-red-800">{slaMetrics.roles_over_30}</div>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3">
                <div className="text-xs text-emerald-600 mb-1">Avg Time to 1st Submission (days)</div>
                <div className="text-2xl font-bold text-emerald-700">{slaMetrics.avg_time_to_first_submission}</div>
              </div>
              <div className="bg-indigo-50 rounded-lg p-3">
                <div className="text-xs text-indigo-600 mb-1">Avg Time to 1st Interview (days)</div>
                <div className="text-2xl font-bold text-indigo-700">{slaMetrics.avg_time_to_first_interview}</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Role</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Days Open</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">First Submission (days)</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">First Interview (days)</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Dropout</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {slaRoles.map((role) => (
                    <tr key={role.id}>
                      <td className="px-4 py-2">
                        <div className="text-sm font-medium text-slate-800">{role.title}</div>
                        <div className="text-xs text-slate-500">{role.role_code}</div>
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-xs px-2 py-1 rounded-full border" >{role.status}</span>
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-sm font-semibold text-slate-800">{role.days_open}</span>
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-sm text-slate-800">{role.first_submission_days ?? '-'}</span>
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-sm text-slate-800">{role.first_interview_days ?? '-'}</span>
                      </td>
                      <td className="px-4 py-2">
                        {role.has_dropout ? (
                          <span className={`text-xs px-2 py-1 rounded-full border ${role.dropout_decision === 'accepted' ? 'bg-green-50 text-green-700 border-green-200' : role.dropout_decision === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                            {role.dropout_decision || 'completed'}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Performance Insights */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4 group cursor-help relative">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Performance Insights</h3>
            <p className="text-sm text-gray-600">Key observations across all teams</p>
          </div>
          <HelpCircle className="w-5 h-5 text-blue-400 hover:text-blue-600 transition-colors ml-auto" />
          <div className="absolute right-0 top-full mt-2 w-96 bg-gray-900 text-white text-sm rounded-lg shadow-xl p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
            <div className="absolute -top-2 right-8 w-4 h-4 bg-gray-900 transform rotate-45"></div>
            <p className="font-semibold mb-2">Organization Performance Insights</p>
            <p className="text-gray-300 leading-relaxed">
              High-level view of organization-wide performance metrics. Identify top performers to recognize, average trends to maintain, and areas requiring intervention. Hover over each insight card for detailed recommendations.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4 border border-blue-200 group cursor-help relative">
            <p className="font-semibold text-blue-900 mb-2">Top Performers</p>
            <p className="text-sm text-blue-800">
              {stats.filter(s => s.ebesScore >= 90).length} user(s) with excellent EBES scores (90+)
            </p>
            <div className="absolute left-0 top-full mt-2 w-80 bg-gray-900 text-white text-sm rounded-lg shadow-xl p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <div className="absolute -top-2 left-4 w-4 h-4 bg-gray-900 transform rotate-45"></div>
              <p className="font-semibold mb-2">Excellence Recognition</p>
              <p className="text-gray-300 leading-relaxed">
                {stats.filter(s => s.ebesScore >= 90).length > 0 
                  ? `Recognize these ${stats.filter(s => s.ebesScore >= 90).length} top performer(s) publicly. Consider them for mentorship roles, special projects, or leadership development. Document and share their best practices with the broader team.`
                  : 'No users currently at excellence level (90+). Set this as an aspirational target and create development programs to help team members reach it.'}
              </p>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-blue-200 group cursor-help relative">
            <p className="font-semibold text-blue-900 mb-2">Average Performance</p>
            <p className="text-sm text-blue-800">
              Organization average EBES: {avgEbesScore.toFixed(1)} - 
              {avgEbesScore >= 80 ? ' Strong' : avgEbesScore >= 70 ? ' Good' : ' Needs Improvement'}
            </p>
            <div className="absolute left-0 top-full mt-2 w-80 bg-gray-900 text-white text-sm rounded-lg shadow-xl p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <div className="absolute -top-2 left-4 w-4 h-4 bg-gray-900 transform rotate-45"></div>
              <p className="font-semibold mb-2">Organization Health</p>
              <p className="text-gray-300 leading-relaxed">
                {avgEbesScore >= 80 
                  ? `Excellent organization-wide performance at ${avgEbesScore.toFixed(1)}. Maintain this through continued training, recognition programs, and process optimization.`
                  : avgEbesScore >= 70 
                  ? `Good baseline at ${avgEbesScore.toFixed(1)}. Target: raise to 80+ through focused coaching on underperforming areas and scaling best practices from top performers.`
                  : `Performance below target at ${avgEbesScore.toFixed(1)}. Urgent: conduct skills gap analysis, implement training programs, and provide intensive coaching to raise organizational capability.`}
              </p>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-blue-200 group cursor-help relative">
            <p className="font-semibold text-blue-900 mb-2">Attention Needed</p>
            <p className="text-sm text-blue-800">
              {stats.filter(s => s.ebesScore < 60).length} user(s) require coaching and support
            </p>
            <div className="absolute left-0 top-full mt-2 w-80 bg-gray-900 text-white text-sm rounded-lg shadow-xl p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <div className="absolute -top-2 left-4 w-4 h-4 bg-gray-900 transform rotate-45"></div>
              <p className="font-semibold mb-2">Support Requirements</p>
              <p className="text-gray-300 leading-relaxed">
                {stats.filter(s => s.ebesScore < 60).length > 0 
                  ? `${stats.filter(s => s.ebesScore < 60).length} user(s) need immediate support. Schedule 1-on-1 coaching sessions, create personalized improvement plans, pair with mentors, and track weekly progress. Consider if role fit or training gaps are issues.`
                  : 'No users currently at-risk. Maintain this through proactive check-ins, regular training, and early intervention when performance trends downward.'}
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
            <p className="text-sm text-slate-600">Strategic initiatives to improve organization performance</p>
          </div>
          <HelpCircle className="w-5 h-5 text-gray-400 hover:text-gray-600 transition-colors ml-auto" />
          <div className="absolute right-0 top-full mt-2 w-96 bg-gray-900 text-white text-sm rounded-lg shadow-xl p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
            <div className="absolute -top-2 right-8 w-4 h-4 bg-gray-900 transform rotate-45"></div>
            <p className="font-semibold mb-2">Strategic Action Plan</p>
            <p className="text-gray-300 leading-relaxed">
              Organization-wide recommendations based on performance data, industry benchmarks, and best practices. Prioritize high-priority actions for maximum impact on team performance.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {(() => {
            const actions = [];
            const underperformers = stats.filter(s => s.ebesScore < 60);
            const recruiters = stats.filter(s => s.role === 'recruiter');
            const avgRecruiterScore = recruiters.length > 0 ? recruiters.reduce((sum, r) => sum + r.ebesScore, 0) / recruiters.length : 0;
            const successRate = totalSubmissions > 0 ? (totalDeals / totalSubmissions) * 100 : 0;

            // High number of underperformers
            if (underperformers.length > stats.length * 0.2) {
              actions.push({
                priority: 'high',
                title: 'Address Widespread Performance Issues',
                description: `${underperformers.length} users (${((underperformers.length / stats.length) * 100).toFixed(0)}%) performing below expectations (EBES < 60).`,
                steps: [
                  'Conduct organization-wide performance review and root cause analysis',
                  'Identify common gaps: training, tools, processes, or role clarity?',
                  'Launch comprehensive training program addressing identified gaps',
                  'Implement weekly coaching sessions for all underperformers',
                  'Create peer mentorship program pairing high and low performers',
                  'Set 30-day improvement targets with milestone check-ins',
                  'Consider if organizational structure or resource allocation needs adjustment'
                ],
                impact: `Raise ${underperformers.length} user(s) above 60 EBES threshold within 60 days`
              });
            }

            // Low organization average
            if (avgEbesScore < 70) {
              actions.push({
                priority: 'high',
                title: 'Improve Organization-Wide Performance',
                description: `Organization average EBES of ${avgEbesScore.toFixed(1)} below industry standard (75-80).`,
                steps: [
                  'Analyze top 20% performers - what are they doing differently?',
                  'Document and standardize successful practices as playbooks',
                  'Conduct skills assessment across all roles to identify training needs',
                  'Implement monthly performance workshops and knowledge sharing',
                  'Review and optimize internal processes that may be bottlenecks',
                  'Set clear performance standards and expectations for each role',
                  'Track progress monthly with transparent dashboards'
                ],
                impact: `Increase organization average from ${avgEbesScore.toFixed(1)} to 75+ within 90 days`
              });
            }

            // Low success rate
            if (successRate < 10 && totalSubmissions > 50) {
              actions.push({
                priority: 'high',
                title: 'Improve Overall Win Rate',
                description: `Success rate of ${successRate.toFixed(1)}% is below industry benchmark (12-15%). ${totalSubmissions} submissions yielding only ${totalDeals} deals.`,
                steps: [
                  'Review client selection and qualification process',
                  'Improve candidate screening and quality standards',
                  'Enhance interview preparation and candidate coaching',
                  'Speed up feedback loops and decision-making processes',
                  'Strengthen hiring manager relationships and expectation setting',
                  'Analyze lost deals to identify preventable patterns',
                  'Consider specialization by industry or role type'
                ],
                impact: `Increase success rate to 12%+, adding ${Math.round((0.12 - successRate/100) * totalSubmissions)} deals with same activity`
              });
            }

            // High dropout rate
            const dropoutRate = (totalDeals + totalDropouts) > 0 ? (totalDropouts / (totalDeals + totalDropouts)) * 100 : 0;
            if (dropoutRate > 20) {
              actions.push({
                priority: 'high',
                title: 'Reduce Organization-Wide Dropout Rate',
                description: `${dropoutRate.toFixed(1)}% dropout rate (${totalDropouts} dropouts vs ${totalDeals} deals) impacts team morale and EBES scores.`,
                steps: [
                  'Conduct exit interviews with all recent dropouts to identify patterns',
                  'Common causes: offer acceptance issues, counter-offers, or role misalignment?',
                  'Implement comprehensive pre-submission candidate vetting checklist',
                  'Train team on candidate commitment assessment techniques',
                  'Improve offer negotiation and closing strategies organization-wide',
                  'Establish post-offer acceptance engagement protocols',
                  'Track dropout reasons in CRM for ongoing analysis'
                ],
                impact: `Reduce dropout rate from ${dropoutRate.toFixed(1)}% to under 15%, saving ${Math.round((dropoutRate - 15) / 100 * totalDropouts)} placements`
              });
            }

            // Low recruiter performance
            if (avgRecruiterScore < 65 && recruiters.length > 0) {
              actions.push({
                priority: 'medium',
                title: 'Strengthen Recruiter Team Performance',
                description: `Recruiter average EBES of ${avgRecruiterScore.toFixed(1)} below target. ${recruiters.length} recruiters need support.`,
                steps: [
                  'Launch recruiter-specific training: sourcing, screening, candidate engagement',
                  'Implement daily stand-ups for pipeline review and problem-solving',
                  'Create clear submission quality standards and checklists',
                  'Pair struggling recruiters with top performers for shadowing',
                  'Review and optimize role assignments - are they well-matched?',
                  'Provide better tools and resources (ATS, sourcing platforms, templates)',
                  'Celebrate and reward improvement with recognition program'
                ],
                impact: `Raise recruiter average from ${avgRecruiterScore.toFixed(1)} to 70+ within 60 days`
              });
            }

            // Recognize strong performance
            if (actions.length === 0 || (avgEbesScore >= 80 && underperformers.length < stats.length * 0.1)) {
              actions.push({
                priority: 'low',
                title: 'Sustain and Scale High Performance',
                description: `Strong organization performance: ${avgEbesScore.toFixed(1)} average EBES, ${stats.filter(s => s.ebesScore >= 90).length} top performers.`,
                steps: [
                  'Document success: create case studies of high-performing teams',
                  'Launch formal mentorship program with top performers as mentors',
                  'Invest in leadership development for high potentials',
                  'Explore market expansion or new service offerings',
                  'Maintain current excellence through continuous improvement culture',
                  'Share organizational success stories for recruitment and client acquisition',
                  'Set aspirational stretch goals: 85+ organization average'
                ],
                impact: 'Scale success, prepare for growth, and maintain competitive advantage'
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

      {/* Leaderboards */}
      {leaderboards && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Recruiter Leaderboard */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-yellow-600" />
              <h3 className="font-bold text-gray-900">Top Recruiters</h3>
            </div>
            <div className="space-y-2">
              {leaderboards.recruiters.slice(0, 5).map((user, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {index === 0 && <span className="text-xl">🥇</span>}
                    {index === 1 && <span className="text-xl">🥈</span>}
                    {index === 2 && <span className="text-xl">🥉</span>}
                    {index > 2 && (
                      <span className="text-gray-500 font-medium w-6">#{index + 1}</span>
                    )}
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{user.name}</p>
                      <p className="text-xs text-gray-500">{user.team}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-indigo-600 text-sm">{user.ebesScore}</p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${getPerformanceColor(
                        user.performanceLabel
                      )}`}
                    >
                      {user.performanceLabel}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Account Manager Leaderboard */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Medal className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-gray-900">Top Account Managers</h3>
            </div>
            <div className="space-y-2">
              {leaderboards.accountManagers.slice(0, 5).map((user, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {index === 0 && <span className="text-xl">🥇</span>}
                    {index === 1 && <span className="text-xl">🥈</span>}
                    {index === 2 && <span className="text-xl">🥉</span>}
                    {index > 2 && (
                      <span className="text-gray-500 font-medium w-6">#{index + 1}</span>
                    )}
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{user.name}</p>
                      <p className="text-xs text-gray-500">{user.team}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-indigo-600 text-sm">{user.ebesScore}</p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${getPerformanceColor(
                        user.performanceLabel
                      )}`}
                    >
                      {user.performanceLabel}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recruitment Manager Leaderboard */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-5 h-5 text-purple-600" />
              <h3 className="font-bold text-gray-900">Top Recruitment Managers</h3>
            </div>
            <div className="space-y-2">
              {leaderboards.recruitmentManagers.slice(0, 5).map((user, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {index === 0 && <span className="text-xl">🥇</span>}
                    {index === 1 && <span className="text-xl">🥈</span>}
                    {index === 2 && <span className="text-xl">🥉</span>}
                    {index > 2 && (
                      <span className="text-gray-500 font-medium w-6">#{index + 1}</span>
                    )}
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{user.name}</p>
                      <p className="text-xs text-gray-500">{user.team}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-indigo-600 text-sm">{user.ebesScore}</p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${getPerformanceColor(
                        user.performanceLabel
                      )}`}
                    >
                      {user.performanceLabel}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-400" />
          <h3 className="font-semibold text-gray-900">Filters</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Role Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="all">All Roles</option>
              <option value="recruiter">Recruiter</option>
              <option value="account_manager">Account Manager</option>
              <option value="recruitment_manager">Recruitment Manager</option>
            </select>
          </div>

          {/* Performance Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Performance Level</label>
            <select
              value={performanceFilter}
              onChange={(e) => setPerformanceFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="all">All Levels</option>
              <option value="Excellent">Excellent</option>
              <option value="Good">Good</option>
              <option value="Average">Average</option>
              <option value="Needs Improvement">Needs Improvement</option>
            </select>
          </div>

          {/* Team Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Team</label>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="all">All Teams</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name} ({team.team_code})
                </option>
              ))}
            </select>
          </div>

          {/* Client Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="all">All Clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} ({client.client_code})
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Custom Date Range */}
          {dateRange === "custom" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </>
          )}

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search User</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Name, email, or code..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Performance Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">User Performance Details</h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">User</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Role</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Team</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Client(s)</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">
                    EBES Score
                  </th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">
                    Performance
                  </th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredStats.map((user) => (
                  <>
                    <tr
                      key={user.user_id}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() =>
                        setExpandedUser(expandedUser === user.user_id ? null : user.user_id)
                      }
                    >
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-gray-900">{user.name}</p>
                          <p className="text-xs text-gray-500">{user.user_code}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-700">
                          {getRoleDisplayName(user.role)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-gray-700">
                          {user.teams.length > 0
                            ? user.teams.map((t) => t.name).join(", ")
                            : "No Team"}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-gray-700">
                          {user.clients.length > 0
                            ? user.clients.map((c) => c.name).join(", ")
                            : "No Clients"}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-indigo-600 text-lg">
                          {user.ebesScore}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getPerformanceColor(
                            user.performanceLabel
                          )}`}
                        >
                          {user.performanceLabel}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {expandedUser === user.user_id ? (
                          <ChevronUp className="w-5 h-5 text-gray-400 mx-auto" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400 mx-auto" />
                        )}
                      </td>
                    </tr>
                    {expandedUser === user.user_id && (
                      <tr className="bg-gray-50">
                        <td colSpan={7} className="py-4 px-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {user.role === "recruiter" && (
                              <>
                                <div className="bg-white p-3 rounded-lg border border-gray-200">
                                  <p className="text-xs text-gray-500 mb-1">Submissions</p>
                                  <p className="text-xl font-bold text-gray-900">
                                    {user.totalSubmissions}
                                  </p>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-gray-200">
                                  <p className="text-xs text-gray-500 mb-1">Interviews</p>
                                  <p className="text-xl font-bold text-gray-900">
                                    {user.totalInterviews}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    1st: {user.interviews1st} | 2nd: {user.interviews2nd} | 3rd:{" "}
                                    {user.interviews3rd}
                                  </p>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-gray-200">
                                  <p className="text-xs text-gray-500 mb-1">Deals</p>
                                  <p className="text-xl font-bold text-green-600">{user.deals}</p>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-gray-200">
                                  <p className="text-xs text-gray-500 mb-1">Drop Outs</p>
                                  <p className="text-xl font-bold text-red-600">
                                    {user.dropouts}
                                  </p>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-gray-200">
                                  <p className="text-xs text-gray-500 mb-1">Active Roles</p>
                                  <p className="text-xl font-bold text-blue-600">
                                    {user.activeRoles}
                                  </p>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-gray-200">
                                  <p className="text-xs text-gray-500 mb-1">Non-Active Roles</p>
                                  <p className="text-xl font-bold text-gray-600">
                                    {user.nonActiveRoles}
                                  </p>
                                </div>
                              </>
                            )}
                            {user.role === "account_manager" && (
                              <>
                                <div className="bg-white p-3 rounded-lg border border-gray-200">
                                  <p className="text-xs text-gray-500 mb-1">Total Roles</p>
                                  <p className="text-xl font-bold text-gray-900">
                                    {user.totalRoles}
                                  </p>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-gray-200">
                                  <p className="text-xs text-gray-500 mb-1">Active Roles</p>
                                  <p className="text-xl font-bold text-blue-600">
                                    {user.activeRoles}
                                  </p>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-gray-200">
                                  <p className="text-xs text-gray-500 mb-1">Deals Closed</p>
                                  <p className="text-xl font-bold text-green-600">
                                    {user.dealsClosedRoles}
                                  </p>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-gray-200">
                                  <p className="text-xs text-gray-500 mb-1">Lost Roles</p>
                                  <p className="text-xl font-bold text-red-600">
                                    {user.lostRoles}
                                  </p>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-gray-200">
                                  <p className="text-xs text-gray-500 mb-1">On Hold</p>
                                  <p className="text-xl font-bold text-yellow-600">
                                    {user.onHoldRoles}
                                  </p>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-gray-200">
                                  <p className="text-xs text-gray-500 mb-1">No Answer</p>
                                  <p className="text-xl font-bold text-gray-600">
                                    {user.noAnswerRoles}
                                  </p>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-gray-200">
                                  <p className="text-xs text-gray-500 mb-1">Interviews</p>
                                  <p className="text-xl font-bold text-purple-600">
                                    {user.totalInterviews}
                                  </p>
                                </div>
                              </>
                            )}
                            {user.role === "recruitment_manager" && (
                              <>
                                <div className="bg-white p-3 rounded-lg border border-gray-200">
                                  <p className="text-xs text-gray-500 mb-1">Teams Managed</p>
                                  <p className="text-xl font-bold text-gray-900">
                                    {user.managedTeams}
                                  </p>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-gray-200">
                                  <p className="text-xs text-gray-500 mb-1">Recruiters</p>
                                  <p className="text-xl font-bold text-blue-600">
                                    {user.totalRecruiters}
                                  </p>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-gray-200">
                                  <p className="text-xs text-gray-500 mb-1">Total Roles</p>
                                  <p className="text-xl font-bold text-gray-900">
                                    {user.totalRoles}
                                  </p>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-gray-200">
                                  <p className="text-xs text-gray-500 mb-1">Active Roles</p>
                                  <p className="text-xl font-bold text-blue-600">
                                    {user.activeRoles}
                                  </p>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-gray-200">
                                  <p className="text-xs text-gray-500 mb-1">Total Deals</p>
                                  <p className="text-xl font-bold text-green-600">
                                    {user.totalDeals}
                                  </p>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-gray-200">
                                  <p className="text-xs text-gray-500 mb-1">Interviews</p>
                                  <p className="text-xl font-bold text-purple-600">
                                    {user.totalInterviews}
                                  </p>
                                </div>
                              </>
                            )}
                          </div>
                          <div className="mt-4 bg-white p-4 rounded-lg border border-gray-200">
                            <p className="text-xs text-gray-500 mb-2">Corrective Actions</p>
                            <ul className="list-disc list-inside text-sm text-gray-700">
                              {getCorrectiveActions(user).map((a, idx) => (
                                <li key={idx}>{a}</li>
                              ))}
                            </ul>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>

            {filteredStats.length === 0 && (
              <div className="text-center py-12">
                <UserCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No users found matching your filters</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
