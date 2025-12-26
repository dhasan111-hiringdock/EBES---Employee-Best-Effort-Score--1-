import { useState, useEffect } from 'react';
import { 
  BarChart3, Users, Target, TrendingDown,
  Filter, Download, AlertTriangle, Award, Lightbulb,
  CheckCircle, AlertCircle, ArrowUp, ArrowDown, History,
  Activity, Briefcase
} from 'lucide-react';
import { fetchWithAuth } from '@/react-app/utils/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts';
import ReportDownloadModal, { type ReportFilters } from '@/react-app/components/admin/ReportDownloadModal';

interface AnalyticsData {
  overview: {
    total_teams: number;
    total_recruiters: number;
    total_active_roles: number;
    total_non_active_roles: number;
    total_deals: number;
    total_interviews: number;
    interviews_level_1?: number;
    interviews_level_2?: number;
    interviews_level_3?: number;
    total_dropouts: number;
    rm_ebes_score: number;
    rm_ebes_label: string;
    cv_quality_average?: number;
    cv_quality_label?: string;
  };
  dropout_reasons?: Array<{ reason: string; count: number }>;
  teams: Array<{
    team_id: number;
    team_name: string;
    team_code: string;
    total_roles: number;
    active_roles: number;
    interviews_level_1: number;
    interviews_level_2: number;
    interviews_level_3: number;
    deals: number;
    dropouts: number;
    conversion_rate: number;
    performance_trend: string;
    cv_quality_average?: number;
    cv_quality_label?: string;
  }>;
  recruiters: Array<{
    recruiter_id: number;
    recruiter_name: string;
    recruiter_code: string;
    submissions: number;
    interviews: number;
    deals: number;
    dropouts: number;
    recruiter_ebes: number;
    recruiter_ebes_label: string;
    performance_trend: string;
    cv_quality_average?: number;
    cv_quality_label?: string;
  }>;
  clients: Array<{
    client_id: number;
    client_name: string;
    client_code: string;
    total_roles: number;
    interviews: number;
    deals: number;
    dropouts: number;
    health: string;
    conversion_rate: number;
    cv_quality_average?: number;
    cv_quality_label?: string;
  }>;
}

interface EbesHistoryPoint {
  recorded_at: string;
  ebes_score: number;
  ebes_label: string;
  total_roles: number;
  total_deals: number;
  total_interviews: number;
  total_dropouts: number;
}

interface PerformanceInsight {
  type: 'warning' | 'success' | 'info' | 'critical';
  title: string;
  description: string;
  metric: string;
  icon: any;
}

interface CorrectiveAction {
  priority: 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  steps: string[];
  expected_impact: string;
}

export default function RMAnalytics() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [ebesHistory, setEbesHistory] = useState<EbesHistoryPoint[]>([]);
  const [insights, setInsights] = useState<PerformanceInsight[]>([]);
  const [actions, setActions] = useState<CorrectiveAction[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  
  // Filter states
  const [dateFilter, setDateFilter] = useState('this_month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [historyDays, setHistoryDays] = useState(30);
  
  // Available options for filters
  const [teams, setTeams] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    fetchAnalytics();
    fetchEbesHistory();
  }, [dateFilter, customStartDate, customEndDate, selectedTeam, selectedClient, historyDays]);

  const fetchFilterOptions = async () => {
    try {
      const [teamsRes, clientsRes] = await Promise.all([
        fetchWithAuth('/api/rm/teams'),
        fetchWithAuth('/api/rm/clients')
      ]);

      if (teamsRes.ok) setTeams(await teamsRes.json());
      if (clientsRes.ok) setClients(await clientsRes.json());
    } catch (error) {
      console.error('Failed to fetch filter options:', error);
    }
  };

  const fetchEbesHistory = async () => {
    try {
      const response = await fetchWithAuth(`/api/rm/ebes-history?days=${historyDays}`);
      if (response.ok) {
        const data = await response.json();
        setEbesHistory(data);
      }
    } catch (error) {
      console.error('Failed to fetch EBES history:', error);
    }
  };

  const saveEbesHistory = async (overview: any) => {
    try {
      await fetchWithAuth('/api/rm/ebes-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ebes_score: overview.rm_ebes_score,
          ebes_label: overview.rm_ebes_label,
          total_roles: overview.total_active_roles + overview.total_non_active_roles,
          total_deals: overview.total_deals,
          total_interviews: overview.total_interviews,
          total_dropouts: overview.total_dropouts
        })
      });
    } catch (error) {
      console.error('Failed to save EBES history:', error);
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      
      // Date range
      if (dateFilter === 'custom' && customStartDate && customEndDate) {
        params.append('start_date', customStartDate);
        params.append('end_date', customEndDate);
      } else if (dateFilter !== 'all_time') {
        const { start, end } = getDateRange(dateFilter);
        params.append('start_date', start);
        params.append('end_date', end);
      }

      if (selectedTeam) params.append('team_id', selectedTeam);
      if (selectedClient) params.append('client_id', selectedClient);

      const response = await fetchWithAuth(`/api/rm/analytics-comprehensive?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
        generateInsights(data);
        generateCorrectiveActions(data);
        
        // Save EBES history if viewing current data (no date filter or this month)
        if (dateFilter === 'this_month' || dateFilter === 'all_time') {
          saveEbesHistory(data.overview);
        }
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = (filter: string) => {
    const now = new Date();
    let start, end;

    switch (filter) {
      case 'this_month':
        start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        end = now.toISOString().split('T')[0];
        break;
      case 'last_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
        end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
        break;
      case 'last_3_months':
        start = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0];
        end = now.toISOString().split('T')[0];
        break;
      default:
        start = '';
        end = '';
    }

    return { start, end };
  };

  const calculateInterviewSuccess = (overview: any) => {
    const interview2 = overview.interviews_level_2 || 0;
    const interview3 = overview.interviews_level_3 || 0;
    const deals = overview.total_deals || 0;
    const totalInterviews = overview.total_interviews || 1;
    
    if (totalInterviews === 0) return 0;
    return ((interview2 + interview3 + deals) / totalInterviews) * 100;
  };

  const generateInsights = (data: AnalyticsData) => {
    const newInsights: PerformanceInsight[] = [];

    // Analyze overall EBES score
    if ((data.overview.rm_ebes_score ?? 0) < 60) {
      newInsights.push({
        type: 'critical',
        title: 'EBES Score Below Target',
        description: `Your current EBES score of ${(data.overview.rm_ebes_score ?? 0).toFixed(1)} is in the "${data.overview.rm_ebes_label}" range. Immediate action required.`,
        metric: `${(data.overview.rm_ebes_score ?? 0).toFixed(1)} / 100`,
        icon: AlertTriangle
      });
    } else if ((data.overview.rm_ebes_score ?? 0) >= 90) {
      newInsights.push({
        type: 'success',
        title: 'Excellent Performance',
        description: `Outstanding EBES score of ${(data.overview.rm_ebes_score ?? 0).toFixed(1)}. Your team is performing exceptionally well.`,
        metric: `${(data.overview.rm_ebes_score ?? 0).toFixed(1)} / 100`,
        icon: Award
      });
    }

    // Identify underperforming recruiters
    const underperformers = data.recruiters.filter(r => (r.recruiter_ebes ?? 0) < 60);
    if (underperformers.length > 0) {
      newInsights.push({
        type: 'warning',
        title: 'Underperforming Recruiters Identified',
        description: `${underperformers.length} recruiter(s) with EBES score below 60. Consider targeted coaching.`,
        metric: `${underperformers.length} recruiter(s)`,
        icon: Users
      });
    }

    // Identify top performers
    const topPerformers = data.recruiters.filter(r => (r.recruiter_ebes ?? 0) >= 90);
    if (topPerformers.length > 0) {
      newInsights.push({
        type: 'success',
        title: 'Top Performers',
        description: `${topPerformers.length} recruiter(s) with excellent EBES scores. Consider recognition or mentorship roles.`,
        metric: `${topPerformers.length} recruiter(s)`,
        icon: Award
      });
    }

    // Analyze dropout rate
    const dropoutRate = data.overview.total_deals > 0 
      ? (data.overview.total_dropouts / (data.overview.total_deals + data.overview.total_dropouts)) * 100 
      : 0;
    
    if (dropoutRate > 30) {
      newInsights.push({
        type: 'warning',
        title: 'High Dropout Rate',
        description: `Dropout rate of ${dropoutRate.toFixed(1)}% is concerning. Review candidate quality and client expectations.`,
        metric: `${dropoutRate.toFixed(1)}%`,
        icon: TrendingDown
      });
    }

    // Analyze client health
    const atRiskClients = data.clients.filter(c => c.health === 'At Risk');
    if (atRiskClients.length > 0) {
      newInsights.push({
        type: 'warning',
        title: 'Clients At Risk',
        description: `${atRiskClients.length} client(s) flagged as "At Risk". Review engagement and delivery.`,
        metric: `${atRiskClients.length} client(s)`,
        icon: AlertCircle
      });
    }

    setInsights(newInsights);
  };

  const handleReportDownload = async (filters: ReportFilters, format: 'csv' | 'excel' | 'pdf') => {
    const selectedFields = (filters.fields && filters.fields.length > 0) ? filters.fields : [
      'user_info','ebes_score','cv_quality_average','cv_quality_label','teams','clients','total_roles','active_roles','interviews_1','interviews_2','interviews_3','total_interviews','deals','dropouts','client_breakdown','team_breakdown'
    ];

    const params = new URLSearchParams();
    if (filters.teamId && filters.teamId !== 'all') params.append('team_id', filters.teamId);
    if (filters.clientId && filters.clientId !== 'all') params.append('client_id', filters.clientId);
    if (filters.dateRange === 'custom' && filters.startDate && filters.endDate) {
      params.append('start_date', filters.startDate);
      params.append('end_date', filters.endDate);
    } else if (filters.dateRange === 'today') {
      const today = new Date().toISOString().split('T')[0];
      params.append('start_date', today);
      params.append('end_date', today);
    } else if (filters.dateRange === 'week') {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      params.append('start_date', weekAgo.toISOString().split('T')[0]);
      params.append('end_date', now.toISOString().split('T')[0]);
    } else if (filters.dateRange === 'month') {
      const now = new Date();
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      params.append('start_date', monthAgo.toISOString().split('T')[0]);
      params.append('end_date', now.toISOString().split('T')[0]);
    }

    let freshData: AnalyticsData | null = null;
    try {
      const res = await fetchWithAuth(`/api/rm/analytics-comprehensive?${params.toString()}`);
      if (res.ok) freshData = await res.json();
    } catch {}

    const o = freshData?.overview || analytics?.overview || {
      total_active_roles: 0,
      total_non_active_roles: 0,
      total_deals: 0,
      total_interviews: 0,
      interviews_level_1: 0,
      interviews_level_2: 0,
      interviews_level_3: 0,
      total_dropouts: 0,
      rm_ebes_score: 0,
      rm_ebes_label: 'No Data',
      cv_quality_average: 0,
      cv_quality_label: ''
    } as any;
    const tlist = freshData?.teams || analytics?.teams || [];
    const clist = freshData?.clients || analytics?.clients || [];

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
      total_roles: ['Total Roles'],
      active_roles: ['Active Roles'],
      interviews_1: ['Interview 1'],
      interviews_2: ['Interview 2'],
      interviews_3: ['Interview 3'],
      total_interviews: ['Total Interviews'],
      deals: ['Deals'],
      dropouts: ['Dropouts'],
      client_breakdown: ['Client Breakdown'],
      team_breakdown: ['Team Breakdown'],
      roles_to_interviews_pct: ['Roles → Interviews %'],
      interviews_to_deals_pct: ['Interviews → Deals %'],
      stage_1_to_2_dropoff_pct: ['Stage 1→2 Drop-off %'],
      stage_2_to_3_dropoff_pct: ['Stage 2→3 Drop-off %'],
      dropout_rate_pct: ['Dropout Rate %'],
      
    };

    const buildParts = () => {
      const parts: string[] = [];
      selectedFields.forEach((f) => {
        if (f === 'user_info') {
          parts.push(`"${userName}"`, userCode, userEmail);
        } else if (f === 'ebes_score') {
          parts.push(String(o.rm_ebes_score || 0), (o.rm_ebes_label || ''));
        } else if (f === 'cv_quality_average') {
          parts.push(String(Math.round((o.cv_quality_average || 0) * 10) / 10));
        } else if (f === 'cv_quality_label') {
          parts.push(o.cv_quality_label || '');
        } else if (f === 'teams') {
          parts.push(`"${tlist.map(t => t.team_name).join('; ')}"`);
        } else if (f === 'clients') {
          parts.push(`"${clist.map(c => c.client_name).join('; ')}"`);
        } else if (f === 'total_roles') {
          parts.push(String((o.total_active_roles || 0) + (o.total_non_active_roles || 0)));
        } else if (f === 'active_roles') {
          parts.push(String(o.total_active_roles || 0));
        } else if (f === 'interviews_1') {
          parts.push(String(o.interviews_level_1 || 0));
        } else if (f === 'interviews_2') {
          parts.push(String(o.interviews_level_2 || 0));
        } else if (f === 'interviews_3') {
          parts.push(String(o.interviews_level_3 || 0));
        } else if (f === 'total_interviews') {
          parts.push(String(o.total_interviews || 0));
        } else if (f === 'deals') {
          parts.push(String(o.total_deals || 0));
        } else if (f === 'dropouts') {
          parts.push(String(o.total_dropouts || 0));
        } else if (f === 'client_breakdown') {
          const cb = clist.map(c => `${c.client_name}: roles ${c.total_roles}, interviews ${c.interviews}, deals ${c.deals}, dropouts ${c.dropouts}`).join('; ');
          parts.push(`"${cb}"`);
        } else if (f === 'team_breakdown') {
          const tb = tlist.map(t => `${t.team_name}: roles ${t.total_roles}, active ${t.active_roles}, interviews ${t.interviews_level_1 + t.interviews_level_2 + t.interviews_level_3}, deals ${t.deals}, dropouts ${t.dropouts}`).join('; ');
          parts.push(`"${tb}"`);
        } else if (f === 'roles_to_interviews_pct') {
          const totalRoles = (o.total_active_roles || 0) + (o.total_non_active_roles || 0);
          const pct = totalRoles > 0 ? Math.round(((o.total_interviews || 0) / totalRoles) * 1000) / 10 : 0;
          parts.push(String(pct));
        } else if (f === 'interviews_to_deals_pct') {
          const totalInt = o.total_interviews || 0;
          const pct = totalInt > 0 ? Math.round(((o.total_deals || 0) / totalInt) * 1000) / 10 : 0;
          parts.push(String(pct));
        } else if (f === 'stage_1_to_2_dropoff_pct') {
          const i1 = o.interviews_level_1 || 0;
          const i2 = o.interviews_level_2 || 0;
          const pct = i1 > 0 ? Math.round(((i1 - i2) / i1) * 1000) / 10 : 0;
          parts.push(String(pct));
        } else if (f === 'stage_2_to_3_dropoff_pct') {
          const i2 = o.interviews_level_2 || 0;
          const i3 = o.interviews_level_3 || 0;
          const pct = i2 > 0 ? Math.round(((i2 - i3) / i2) * 1000) / 10 : 0;
          parts.push(String(pct));
        } else if (f === 'dropout_rate_pct') {
          const totalInt = o.total_interviews || 0;
          const pct = totalInt > 0 ? Math.round(((o.total_dropouts || 0) / totalInt) * 1000) / 10 : 0;
          parts.push(String(pct));
        }
      });
      return parts;
    };

    const headers: string[] = [];
    selectedFields.forEach((f) => { const h = headerMap[f]; if (h) headers.push(...h); });
    const rows: string[] = [];
    rows.push(`"RM Report - ${new Date().toLocaleDateString()}"`);
    rows.push('');
    rows.push(headers.join(','));
    rows.push(buildParts().join(','));
    const mime = format === 'excel' ? 'application/vnd.ms-excel;charset=utf-8;' : (format === 'csv' ? 'text/csv;charset=utf-8;' : 'text/html');
    if (format === 'pdf') {
      const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>RM Report</title></head><body><h2>Recruitment Manager Report</h2><table style=\"border-collapse:collapse;width:100%\"><thead><tr>${headers.map((h) => `<th style=\"padding:8px;border:1px solid #ddd;text-align:left\">${h}</th>`).join('')}</tr></thead><tbody><tr>${buildParts().map((p) => `<td style=\"padding:8px;border:1px solid #ddd;\">${p}</td>`).join('')}</tr></tbody></table></body></html>`;
      const blob = new Blob([html], { type: mime });
      const url = URL.createObjectURL(blob);
      const w = window.open(url);
      if (w) w.addEventListener('load', () => { w.print(); });
    } else {
      const blob = new Blob([rows.join('\n')], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rm-report-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const generateCorrectiveActions = (data: AnalyticsData) => {
    const newActions: CorrectiveAction[] = [];

    // For underperforming recruiters - PERSONALIZED
    const underperformers = data.recruiters.filter(r => (r.recruiter_ebes ?? 0) < 60);
    if (underperformers.length > 0) {
      underperformers.forEach(recruiter => {
        const targetScore = 75; // Realistic target
        const pointsNeeded = targetScore - (recruiter.recruiter_ebes ?? 0);
        const specificIssues: string[] = [];
        const specificSteps: string[] = [];

        // Analyze specific issues
        if (recruiter.submissions < 5) {
          specificIssues.push('very low submission volume');
          specificSteps.push(`${recruiter.recruiter_name} needs to increase submissions from ${recruiter.submissions} to at least 10-15 per period`);
        }
        if (recruiter.interviews === 0) {
          specificIssues.push('no interviews scheduled');
          specificSteps.push(`Focus on candidate quality - ${recruiter.recruiter_name} has ${recruiter.submissions} submissions but 0 interviews`);
        } else if (recruiter.submissions > 0 && recruiter.interviews / recruiter.submissions < 0.3) {
          specificIssues.push('low interview conversion');
          specificSteps.push(`Review ${recruiter.recruiter_name}'s candidate screening - only ${Math.round((recruiter.interviews / recruiter.submissions) * 100)}% reaching interview stage`);
        }
        if (recruiter.deals === 0 && recruiter.interviews > 0) {
          specificIssues.push('interviews not converting to deals');
          specificSteps.push(`${recruiter.recruiter_name} has ${recruiter.interviews} interviews but 0 deals - review candidate-role fit assessment`);
        }
        if (recruiter.dropouts > recruiter.deals) {
          specificIssues.push('high dropout rate');
          specificSteps.push(`${recruiter.recruiter_name} has ${recruiter.dropouts} dropouts vs ${recruiter.deals} deals - investigate root causes immediately`);
        }

        if (specificIssues.length === 0) {
          specificIssues.push('low overall activity');
          specificSteps.push(`${recruiter.recruiter_name} needs to increase engagement across all metrics`);
        }

        // Add targeted action
        specificSteps.push(`Set weekly check-ins with ${recruiter.recruiter_name} to track progress`);
        specificSteps.push(`Target: Achieve ${targetScore} EBES score (current: ${(recruiter.recruiter_ebes ?? 0).toFixed(1)})`);
        
        // Find top performer for mentorship
        const topPerformer = data.recruiters.find(r => (r.recruiter_ebes ?? 0) >= 90);
        if (topPerformer) {
          specificSteps.push(`Pair ${recruiter.recruiter_name} with ${topPerformer.recruiter_name} (EBES: ${(topPerformer.recruiter_ebes ?? 0).toFixed(1)}) for shadowing`);
        }

        newActions.push({
          priority: 'high',
          category: 'Individual Performance',
          title: `Improve ${recruiter.recruiter_name}'s Performance`,
          description: `EBES score ${(recruiter.recruiter_ebes ?? 0).toFixed(1)}/100. Main issues: ${specificIssues.join(', ')}.`,
          steps: specificSteps,
          expected_impact: `Target: ${targetScore} EBES score (+${pointsNeeded.toFixed(1)} points) within 30 days`
        });
      });
    }

    // For high dropout rate - PERSONALIZED
    const dropoutRate = data.overview.total_deals > 0 
      ? (data.overview.total_dropouts / (data.overview.total_deals + data.overview.total_dropouts)) * 100 
      : 0;
    
    if (dropoutRate > 20) {
      const highDropoutRecruiters = data.recruiters.filter(r => r.dropouts > r.deals && r.dropouts > 0);
      const targetRate = 15;
      const steps: string[] = [];

      steps.push(`Current team dropout rate: ${dropoutRate.toFixed(1)}% (${data.overview.total_dropouts} dropouts vs ${data.overview.total_deals} deals)`);
      
      if (highDropoutRecruiters.length > 0) {
        steps.push(`High-risk recruiters: ${highDropoutRecruiters.map(r => `${r.recruiter_name} (${r.dropouts} dropouts, ${r.deals} deals)`).join(', ')}`);
        steps.push('Conduct 1-on-1 reviews with each high-risk recruiter to identify patterns');
      } else {
        steps.push('Review all recent dropouts to identify common patterns');
      }
      
      steps.push('Analyze dropout reasons: candidate declined offer, failed background check, or client withdrew?');
      steps.push('Implement pre-submission checklist: candidate commitment level, salary expectations alignment, notice period');
      steps.push('Schedule weekly pipeline review meetings to catch at-risk placements early');
      
      const worstClient = data.clients.reduce((prev, curr) => 
        (curr.dropouts > prev.dropouts) ? curr : prev, data.clients[0]);
      if (worstClient && worstClient.dropouts > 0) {
        steps.push(`Priority client review: ${worstClient.client_name} (${worstClient.dropouts} dropouts) - assess expectations and communication`);
      }

      newActions.push({
        priority: dropoutRate > 30 ? 'high' : 'medium',
        category: 'Quality & Risk Management',
        title: 'Reduce Dropout Rate Across Team',
        description: `Dropout rate of ${dropoutRate.toFixed(1)}% exceeds acceptable levels. Need immediate intervention.`,
        steps,
        expected_impact: `Target: Reduce dropout rate to ${targetRate}% (saving ~${Math.round((dropoutRate - targetRate) / 100 * data.overview.total_dropouts)} placements)`
      });
    }

    // For at-risk clients - PERSONALIZED
    const atRiskClients = data.clients.filter(c => c.health === 'At Risk');
    if (atRiskClients.length > 0) {
      atRiskClients.forEach(client => {
        const conversionRate = client.interviews > 0 ? (client.deals / client.interviews * 100) : 0;
        const steps: string[] = [];
        const issues: string[] = [];

        // Identify specific issues
        if (client.deals === 0 && client.total_roles > 3) {
          issues.push('no deals closed despite multiple roles');
          steps.push(`${client.client_name} has ${client.total_roles} roles but 0 deals - schedule urgent meeting to review expectations`);
        }
        if (client.dropouts > client.deals) {
          issues.push('more dropouts than successful placements');
          steps.push(`${client.client_name}: ${client.dropouts} dropouts vs ${client.deals} deals - assess candidate quality and role requirements`);
        }
        if (conversionRate < 20 && client.interviews > 0) {
          issues.push('low interview-to-deal conversion');
          steps.push(`Only ${conversionRate.toFixed(1)}% of ${client.client_name}'s interviews convert to deals - review screening process`);
        }
        if (client.interviews === 0 && client.total_roles > 0) {
          issues.push('no candidate reaching interview stage');
          steps.push(`${client.client_name} has ${client.total_roles} roles but 0 interviews - candidate sourcing needs complete overhaul`);
        }

        steps.push(`Schedule face-to-face meeting with ${client.client_name} stakeholders within 48 hours`);
        steps.push('Prepare detailed performance report showing submission-to-hire funnel');
        steps.push('Identify and address any misalignment in role requirements or expectations');
        steps.push(`Assign senior recruiter or account manager as dedicated point of contact for ${client.client_name}`);

        newActions.push({
          priority: 'high',
          category: 'Client Relationship',
          title: `Save ${client.client_name} Account`,
          description: `Client health: At Risk. ${issues.join('; ')}. Immediate action required.`,
          steps,
          expected_impact: `Restore ${client.client_name} relationship and prevent account loss`
        });
      });
    }

    // Add positive reinforcement for top performers
    const topPerformers = data.recruiters.filter(r => (r.recruiter_ebes ?? 0) >= 90);
    if (topPerformers.length > 0 && underperformers.length > 0) {
      newActions.push({
        priority: 'low',
        category: 'Team Recognition',
        title: 'Leverage Top Performers for Team Growth',
        description: `${topPerformers.length} recruiter(s) performing excellently. Use them to uplift the team.`,
        steps: [
          ...topPerformers.map(r => `Recognize ${r.recruiter_name}'s achievement (EBES: ${(r.recruiter_ebes ?? 0).toFixed(1)}, ${r.deals} deals, ${r.submissions} submissions)`),
          'Establish peer mentorship program pairing top and developing performers',
          'Document and share best practices from high performers',
          'Consider bonus or recognition for consistent excellence'
        ],
        expected_impact: 'Improve team morale and knowledge sharing, raising overall performance'
      });
    }

    // Team-wide improvements only if no critical individual issues
    if (underperformers.length === 0 && dropoutRate < 20 && atRiskClients.length === 0) {
      const avgScore = data.recruiters.reduce((sum, r) => sum + (r.recruiter_ebes ?? 0), 0) / Math.max(data.recruiters.length, 1);
      if (avgScore < 80) {
        newActions.push({
          priority: 'medium',
          category: 'Team Development',
          title: 'Elevate Overall Team Performance',
          description: `Team average EBES: ${avgScore.toFixed(1)}. Room for improvement to reach excellence.`,
          steps: [
            'Conduct skills assessment to identify training needs',
            'Implement weekly best practices sharing sessions',
            'Set team goals for next quarter with individual accountability',
            'Review and optimize role assignment strategy',
            'Introduce performance dashboards for real-time tracking'
          ],
          expected_impact: `Target: Raise team average EBES from ${avgScore.toFixed(1)} to 80+ within 60 days`
        });
      }
    }

    // Sort by priority
    newActions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    setActions(newActions);
  };



  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700 border-red-300';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'low': return 'bg-blue-100 text-blue-700 border-blue-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'critical': return 'bg-red-50 border-red-300';
      case 'warning': return 'bg-yellow-50 border-yellow-300';
      case 'success': return 'bg-emerald-50 border-emerald-300';
      case 'info': return 'bg-blue-50 border-blue-300';
      default: return 'bg-gray-50 border-gray-300';
    }
  };

  const getInsightIconColor = (type: string) => {
    switch (type) {
      case 'critical': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      case 'success': return 'text-emerald-600';
      case 'info': return 'text-blue-600';
      default: return 'text-gray-600';
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
      <ReportDownloadModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        teams={teams.map((t: any) => ({ id: t.id, name: t.name, team_code: t.team_code }))}
        clients={clients.map((c: any) => ({ id: c.id, name: c.name, client_code: c.client_code }))}
        onDownload={handleReportDownload}
        allowedRoles={["recruitment_manager","recruiter"]}
      />
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Advanced Analytics</h2>
          <p className="text-slate-600 mt-1">Performance insights and corrective action recommendations</p>
        </div>
        <button
          onClick={() => setShowReportModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all font-medium shadow-lg"
        >
          <Download className="w-4 h-4" />
          Download Report
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Filter className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-bold text-slate-800">Filters</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Date Range</label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="last_3_months">Last 3 Months</option>
              <option value="custom">Custom Range</option>
              <option value="all_time">All Time</option>
            </select>
          </div>

          {dateFilter === 'custom' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Start Date</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">End Date</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Team</label>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Teams</option>
              {teams.map(team => (
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
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      {analytics?.overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-8 h-8 text-blue-500" />
              <span className="text-2xl font-bold text-slate-800">{analytics.overview.total_recruiters}</span>
            </div>
            <p className="text-slate-600 text-sm font-medium">Active Recruiters</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-indigo-500">
             <div className="flex items-center justify-between mb-2">
                <Briefcase className="w-8 h-8 text-indigo-500" />
                <span className="text-2xl font-bold text-slate-800">{analytics.overview.total_active_roles}</span>
             </div>
             <p className="text-slate-600 text-sm font-medium">Active Roles</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-purple-500">
             <div className="flex items-center justify-between mb-2">
                <Activity className="w-8 h-8 text-purple-500" />
                <span className="text-2xl font-bold text-slate-800">{analytics.overview.total_interviews}</span>
             </div>
             <p className="text-slate-600 text-sm font-medium">Total Interviews</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-emerald-500">
             <div className="flex items-center justify-between mb-2">
                <Award className="w-8 h-8 text-emerald-500" />
                <span className="text-2xl font-bold text-slate-800">{analytics.overview.total_deals}</span>
             </div>
             <p className="text-slate-600 text-sm font-medium">Total Deals</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-teal-500">
            <div className="flex items-center justify-between mb-2">
              <Target className="w-8 h-8 text-teal-500" />
              <span className="text-2xl font-bold text-slate-800">{calculateInterviewSuccess(analytics.overview).toFixed(1)}%</span>
            </div>
            <p className="text-slate-600 text-sm font-medium">Interview Success</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-orange-500">
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="w-8 h-8 text-orange-500" />
              <span className="text-2xl font-bold text-slate-800">{(analytics.overview.cv_quality_average ?? 0).toFixed(1)}%</span>
            </div>
            <p className="text-slate-600 text-sm font-medium">CV Quality</p>
            <p className="text-xs text-slate-400 mt-1">{analytics.overview.cv_quality_label ?? 'N/A'}</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-red-500">
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="w-8 h-8 text-red-500" />
              <span className="text-2xl font-bold text-slate-800">{analytics.overview.total_dropouts}</span>
            </div>
            <p className="text-slate-600 text-sm font-medium">Total Dropouts</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-indigo-500">
            <div className="flex items-center justify-between mb-2">
              <Award className="w-8 h-8 text-indigo-500" />
              <span className="text-2xl font-bold text-slate-800">{(analytics.overview.rm_ebes_score ?? 0).toFixed(1)}</span>
            </div>
            <p className="text-slate-600 text-sm font-medium">RM EBES</p>
            <p className="text-xs text-slate-400 mt-1">{analytics.overview.rm_ebes_label}</p>
          </div>
        </div>
      )}

      {analytics?.dropout_reasons && analytics.dropout_reasons.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Dropout Reasons</h3>
              <p className="text-sm text-slate-500">Distribution of recorded reasons</p>
            </div>
          </div>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.dropout_reasons}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="reason" tick={{ fontSize: 12 }} stroke="#64748b" />
                <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }} />
                <Legend />
                <Bar dataKey="count" name="Count" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* EBES History Chart */}
      {ebesHistory.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
                <History className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">EBES Score History</h3>
                <p className="text-sm text-slate-500">Track your performance over time</p>
              </div>
            </div>
            <select
              value={historyDays}
              onChange={(e) => setHistoryDays(parseInt(e.target.value))}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value={7}>Last 7 Days</option>
              <option value={14}>Last 14 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
            </select>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={ebesHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="recorded_at" 
                stroke="#64748b"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis 
                stroke="#64748b"
                tick={{ fontSize: 12 }}
                domain={[0, 100]}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px'
                }}
                labelFormatter={(value) => new Date(value).toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="ebes_score" 
                stroke="#6366f1" 
                strokeWidth={3}
                dot={{ fill: '#6366f1', r: 4 }}
                activeDot={{ r: 6 }}
                name="EBES Score"
              />
            </LineChart>
          </ResponsiveContainer>

          {/* Additional Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <p className="text-sm font-medium text-blue-600 mb-1">Current Score</p>
              <p className="text-2xl font-bold text-blue-700">
                {(ebesHistory[ebesHistory.length - 1]?.ebes_score ?? 0).toFixed(1)}
              </p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
              <p className="text-sm font-medium text-emerald-600 mb-1">Highest Score</p>
              <p className="text-2xl font-bold text-emerald-700">
                {Math.max(...ebesHistory.map(h => h.ebes_score ?? 0)).toFixed(1)}
              </p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
              <p className="text-sm font-medium text-yellow-600 mb-1">Average Score</p>
              <p className="text-2xl font-bold text-yellow-700">
                {(ebesHistory.reduce((sum, h) => sum + (h.ebes_score ?? 0), 0) / Math.max(ebesHistory.length, 1)).toFixed(1)}
              </p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
              <p className="text-sm font-medium text-purple-600 mb-1">Trend</p>
              <div className="flex items-center justify-center gap-2">
                {ebesHistory.length >= 2 && 
                  ebesHistory[ebesHistory.length - 1].ebes_score > ebesHistory[ebesHistory.length - 2].ebes_score ? (
                  <>
                    <ArrowUp className="w-6 h-6 text-emerald-600" />
                    <span className="text-xl font-bold text-emerald-600">Up</span>
                  </>
                ) : (
                  <>
                    <ArrowDown className="w-6 h-6 text-red-600" />
                    <span className="text-xl font-bold text-red-600">Down</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Performance Tables */}
      {analytics && (
        <>
          {/* Recruiter Performance */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Recruiter Performance Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Recruiter</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Submissions</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Interviews</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Deals</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Dropouts</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">EBES Score</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Performance</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">CV Quality</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.recruiters
                    .sort((a, b) => b.recruiter_ebes - a.recruiter_ebes)
                    .map((recruiter) => (
                      <tr key={recruiter.recruiter_id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-slate-800">{recruiter.recruiter_name}</p>
                            <p className="text-sm text-slate-500">{recruiter.recruiter_code}</p>
                          </div>
                        </td>
                        <td className="text-right py-3 px-4 font-semibold text-slate-800">{recruiter.submissions}</td>
                        <td className="text-right py-3 px-4 text-indigo-600 font-semibold">{recruiter.interviews}</td>
                        <td className="text-right py-3 px-4 text-emerald-600 font-semibold">{recruiter.deals}</td>
                        <td className="text-right py-3 px-4 text-red-600 font-semibold">{recruiter.dropouts}</td>
                        <td className="text-right py-3 px-4">
                          <div className="flex flex-col items-end">
                            <span className={`font-bold text-xl ${
                              (recruiter.recruiter_ebes ?? 0) >= 90 ? 'text-emerald-600' :
                              (recruiter.recruiter_ebes ?? 0) >= 75 ? 'text-blue-600' :
                              (recruiter.recruiter_ebes ?? 0) >= 60 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {(recruiter.recruiter_ebes ?? 0).toFixed(1)}
                            </span>
                          </div>
                        </td>
                        <td className="text-center py-3 px-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            recruiter.recruiter_ebes_label === 'Excellent' ? 'bg-emerald-100 text-emerald-700' :
                            recruiter.recruiter_ebes_label === 'Strong' ? 'bg-blue-100 text-blue-700' :
                            recruiter.recruiter_ebes_label === 'Average' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {recruiter.recruiter_ebes_label}
                          </span>
                        </td>
                        <td className="text-center py-3 px-4">
                          <span className="text-sm font-semibold text-slate-800">
                            {(recruiter.cv_quality_average ?? 0).toFixed(1)}%
                          </span>
                          <div className="text-xs text-slate-500">{recruiter.cv_quality_label ?? 'N/A'}</div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Team Performance */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Team Performance Analysis</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Team</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Total Roles</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Active</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Deals</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Dropouts</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Conversion %</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">CV Quality</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.teams.map((team) => {
                    const conversionRate = team.total_roles > 0 ? (team.deals / team.total_roles * 100) : 0;
                    return (
                      <tr key={team.team_id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-slate-800">{team.team_name}</p>
                            <p className="text-sm text-slate-500">{team.team_code}</p>
                          </div>
                        </td>
                        <td className="text-right py-3 px-4 font-semibold text-slate-800">{team.total_roles}</td>
                        <td className="text-right py-3 px-4 text-emerald-600 font-semibold">{team.active_roles}</td>
                        <td className="text-right py-3 px-4 text-yellow-600 font-semibold">{team.deals}</td>
                        <td className="text-right py-3 px-4 text-red-600 font-semibold">{team.dropouts}</td>
                        <td className="text-right py-3 px-4">
                          <span className={`font-bold ${
                            conversionRate >= 25 ? 'text-emerald-600' :
                            conversionRate >= 15 ? 'text-blue-600' :
                            conversionRate >= 10 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {conversionRate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="text-center py-3 px-4">
                          <span className="text-sm font-semibold text-slate-800">
                            {(team.cv_quality_average ?? 0).toFixed(1)}%
                          </span>
                          <div className="text-xs text-slate-500">{team.cv_quality_label ?? 'N/A'}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Client Impact Analysis */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Client Impact on Performance</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Client</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Roles</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Interviews</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Deals</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Dropouts</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Health</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">CV Quality</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.clients.map((client) => (
                    <tr key={client.client_id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-slate-800">{client.client_name}</p>
                          <p className="text-sm text-slate-500">{client.client_code}</p>
                        </div>
                      </td>
                      <td className="text-right py-3 px-4 font-semibold text-slate-800">{client.total_roles}</td>
                      <td className="text-right py-3 px-4 text-indigo-600 font-semibold">{client.interviews}</td>
                      <td className="text-right py-3 px-4 text-emerald-600 font-semibold">{client.deals}</td>
                      <td className="text-right py-3 px-4 text-red-600 font-semibold">{client.dropouts}</td>
                      <td className="text-center py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          client.health === 'Strong' ? 'bg-emerald-100 text-emerald-700' :
                          client.health === 'At Risk' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {client.health}
                        </span>
                      </td>
                      <td className="text-center py-3 px-4">
                        <span className="text-sm font-semibold text-slate-800">
                          {(client.cv_quality_average ?? 0).toFixed(1)}%
                        </span>
                        <div className="text-xs text-slate-500">{client.cv_quality_label ?? 'N/A'}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Performance Insights */}
      {insights.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Performance Insights</h3>
              <p className="text-sm text-slate-500">AI-powered analysis of your team's performance</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map((insight, index) => {
              const Icon = insight.icon;
              return (
                <div 
                  key={index}
                  className={`border-2 rounded-xl p-5 ${getInsightColor(insight.type)}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`flex-shrink-0 ${getInsightIconColor(insight.type)}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-800 mb-1">{insight.title}</h4>
                      <p className="text-sm text-slate-600 mb-2">{insight.description}</p>
                      <div className="inline-block px-3 py-1 bg-white/50 rounded-lg">
                        <span className="text-sm font-semibold text-slate-700">{insight.metric}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Corrective Actions */}
      {actions.length > 0 && (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl shadow-lg border-2 border-indigo-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center">
              <Lightbulb className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">Recommended Corrective Actions</h3>
              <p className="text-sm text-slate-600">AI-generated action plan based on current performance data</p>
            </div>
          </div>

          <div className="space-y-4">
            {actions.map((action, index) => (
              <div key={index} className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border-2 ${getPriorityColor(action.priority)}`}>
                        {action.priority} Priority
                      </span>
                      <span className="text-xs font-medium text-slate-500">{action.category}</span>
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
                  <p className="text-sm text-indigo-700 mt-1">{action.expected_impact}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
