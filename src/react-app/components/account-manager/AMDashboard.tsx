import { useState, useEffect, useRef } from 'react';
import { Target, TrendingUp, Building2, Users, AlertCircle, Clock } from 'lucide-react';
import { fetchWithAuth } from '@/react-app/utils/api';
import ScoreTooltip from '@/react-app/components/shared/ScoreTooltip';
import { useLocation } from 'react-router';

interface Client {
  id: number;
  name: string;
  client_code: string;
  total_roles: number;
  active_roles: number;
  interviews: number;
  deals: number;
  dropouts: number;
  health: string;
}

export default function AMDashboard() {
  const [ebesScore, setEbesScore] = useState(0);
  const [ebesLabel, setEbesLabel] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [pendingDropouts, setPendingDropouts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agingMetrics, setAgingMetrics] = useState<{ avg_days_open: number; roles_over_14: number; roles_over_30: number; avg_time_to_first_submission: number; avg_time_to_first_interview: number } | null>(null);
  const [agingRoles, setAgingRoles] = useState<Array<{ id: number; role_code: string; title: string; status: string; days_open: number; first_submission_days: number | null; first_interview_days: number | null; has_dropout: boolean; dropout_decision: string | null }>>([]);
  const [dailyReport, setDailyReport] = useState<{ day_before_yesterday: any; yesterday: any } | null>(null);
  const [newSubmissionsCount, setNewSubmissionsCount] = useState(0);
  const location = useLocation();
  const dailySectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchDashboardData();
    fetchNewSubmissionNotifications();
  }, []);

 
 
  useEffect(() => {
    if (!loading && dailyReport && location.pathname.endsWith('/am/daily-report')) {
      dailySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loading, dailyReport, location.pathname]);
  const fetchDashboardData = async () => {
    try {
      const [ebesRes, clientsRes, dropoutsRes, agingRes, dailyRes] = await Promise.all([
        fetchWithAuth('/api/am/ebes-score'),
        fetchWithAuth('/api/am/client-analytics'),
        fetchWithAuth('/api/am/dropout-requests'),
        fetchWithAuth('/api/am/aging'),
        fetchWithAuth('/api/am/reports/daily')
      ]);

      if (ebesRes.ok) {
        const ebesData = await ebesRes.json();
        setEbesScore(ebesData.score);
        setEbesLabel(ebesData.performance_label);
      } else {
        const errorData = await ebesRes.json().catch(() => ({ error: ebesRes.statusText }));
        throw new Error(`EBES Score: ${errorData.error || ebesRes.statusText}`);
      }

      if (clientsRes.ok) {
        const clientsData = await clientsRes.json();
        setClients(clientsData);
      } else {
        const errorData = await clientsRes.json().catch(() => ({ error: clientsRes.statusText }));
        console.error('Failed to fetch clients:', errorData.error);
      }

      if (dropoutsRes.ok) {
        const dropoutsData = await dropoutsRes.json();
        setPendingDropouts(dropoutsData.length);
      } else {
        const errorData = await dropoutsRes.json().catch(() => ({ error: dropoutsRes.statusText }));
        console.error('Failed to fetch dropouts:', errorData.error);
      }

      if (agingRes.ok) {
        const agingData = await agingRes.json();
        setAgingMetrics(agingData.metrics);
        setAgingRoles(agingData.roles);
      } else {
        const errorData = await agingRes.json().catch(() => ({ error: agingRes.statusText }));
        console.error('Failed to fetch aging metrics:', errorData.error);
      }

      if (dailyRes.ok) {
        const dailyData = await dailyRes.json();
        setDailyReport(dailyData);
      } else {
        const errorData = await dailyRes.json().catch(() => ({ error: dailyRes.statusText }));
        console.error('Failed to fetch daily report:', errorData.error);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchNewSubmissionNotifications = async () => {
    try {
      const res = await fetchWithAuth('/api/notifications?unread_only=true&limit=50');
      if (res.ok) {
        const items = await res.json();
        const count = (items || []).filter(
          (n: any) => (n as any).type === 'system' && (n as any).title === 'New Submission'
        ).length;
        setNewSubmissionsCount(count);
      }
    } catch (e) {
      console.error('Failed to fetch new submission notifications:', e);
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'Strong': return 'text-green-700 bg-green-100 border-green-200';
      case 'Average': return 'text-yellow-700 bg-yellow-100 border-yellow-200';
      case 'At Risk': return 'text-red-700 bg-red-100 border-red-200';
      default: return 'text-slate-700 bg-slate-100 border-slate-200';
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'Strong': return '💪';
      case 'Average': return '😐';
      case 'At Risk': return '⚠️';
      default: return '❓';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-200 border-t-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-slate-800 mb-2">Failed to Load Dashboard</h3>
        <p className="text-slate-600 mb-4 text-center max-w-md">{error}</p>
        <button
          onClick={fetchDashboardData}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Dashboard</h1>
        <p className="text-slate-600">Your performance overview and client health monitoring</p>
      </div>

      {newSubmissionsCount > 0 && (
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-lg">
                <Target className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-1">New Submissions</h3>
                <p className="text-indigo-100">
                  You have {newSubmissionsCount} new {newSubmissionsCount === 1 ? 'submission' : 'submissions'} awaiting your review
                </p>
              </div>
            </div>
            <a
              href="/am/roles"
              className="px-6 py-3 bg-white text-indigo-700 font-semibold rounded-lg hover:bg-indigo-50 transition-colors shadow-lg"
            >
              Review Submissions
            </a>
          </div>
        </div>
      )}

      {/* Pending Dropouts Alert */}
      {pendingDropouts > 0 && (
        <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-lg">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-1">Dropout Decisions Needed</h3>
                <p className="text-orange-100">You have {pendingDropouts} pending dropout {pendingDropouts === 1 ? 'request' : 'requests'} requiring your decision</p>
              </div>
            </div>
            <a
              href="/am/dropouts"
              className="px-6 py-3 bg-white text-orange-600 font-semibold rounded-lg hover:bg-orange-50 transition-colors shadow-lg"
            >
              Review Now
            </a>
          </div>
        </div>
      )}

      {/* EBES Score Card */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-xl p-8 text-white">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-6 h-6" />
              <h2 className="text-xl font-semibold">Your EBES Score</h2>
            </div>
            <p className="text-indigo-100 text-sm">Employee Best Effort Score</p>
          </div>
          <ScoreTooltip type="ebes" score={ebesScore} label={ebesLabel} />
        </div>

        <div className="flex items-end gap-6">
          <div className="flex-1">
            <div className="text-6xl font-bold mb-2">{ebesScore.toFixed(1)}</div>
            <div className="flex items-center gap-2">
              <span className="px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium">
                {ebesLabel}
              </span>
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          <div className="text-right">
            <div className="text-sm text-indigo-100 mb-1">Performance Level</div>
            <div className="w-32 h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${Math.min(ebesScore, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {dailyReport && (
        <div ref={dailySectionRef} className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              Daily Report
            </h2>
            <p className="text-sm text-slate-600 mt-1">Yesterday vs day before yesterday</p>
          </div>
          <div className="p-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-600">Metric</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-600">Yesterday</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-600">Day Before</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {[
                  { key: 'roles_created', label: 'Roles Created' },
                  { key: 'submissions', label: 'Submissions' },
                  { key: 'forwarded_to_client', label: 'Forwarded to Client' },
                  { key: 'client_rejected', label: 'Client Rejected' },
                  { key: 'interviews', label: 'Interviews' },
                  { key: 'deals', label: 'Deals' },
                  { key: 'discarded', label: 'Discarded Candidates' },
                ].map((row) => (
                  <tr key={row.key}>
                    <td className="px-4 py-2 text-sm text-slate-700">{row.label}</td>
                    <td className="px-4 py-2 text-sm font-semibold text-slate-900">{(dailyReport as any).yesterday?.[row.key] ?? 0}</td>
                    <td className="px-4 py-2 text-sm text-slate-700">{(dailyReport as any).day_before_yesterday?.[row.key] ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4">
              <div className="text-sm text-slate-700 font-semibold mb-2">Role Status Changes</div>
              <div className="grid grid-cols-5 gap-3">
                {[
                  { key: 'deal', label: 'Deal' },
                  { key: 'lost', label: 'Lost' },
                  { key: 'on_hold', label: 'On Hold' },
                  { key: 'cancelled', label: 'Cancelled' },
                  { key: 'no_answer', label: 'No Answer' },
                ].map((s) => (
                  <div key={s.key} className="bg-slate-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-slate-500 mb-1">{s.label}</div>
                    <div className="text-lg font-bold text-slate-800">{(dailyReport as any).yesterday?.role_status_changes?.[s.key] ?? 0}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Client Health Overview */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Client Health
              </h2>
              <p className="text-sm text-slate-600 mt-1">Monitor your clients' performance and engagement</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Users className="w-4 h-4" />
              <span>{clients.length} {clients.length === 1 ? 'Client' : 'Clients'}</span>
            </div>
          </div>
        </div>

        {clients.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600">No client data available</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {clients.map((client) => (
              <div key={client.id} className="p-6 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-slate-800">{client.name}</h3>
                      <span className="text-sm text-slate-500 font-mono">{client.client_code}</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getHealthColor(client.health)}`}>
                        {getHealthIcon(client.health)} {client.health}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-4">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Total Roles</div>
                    <div className="text-2xl font-bold text-slate-800">{client.total_roles}</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="text-xs text-blue-600 mb-1">Active</div>
                    <div className="text-2xl font-bold text-blue-700">{client.active_roles}</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3">
                    <div className="text-xs text-purple-600 mb-1">Interviews</div>
                    <div className="text-2xl font-bold text-purple-700">{client.interviews}</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="text-xs text-green-600 mb-1">Deals</div>
                    <div className="text-2xl font-bold text-green-700">{client.deals}</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3">
                    <div className="text-xs text-red-600 mb-1">Dropouts</div>
                    <div className="text-2xl font-bold text-red-700">{client.dropouts}</div>
                  </div>
                </div>

                {client.total_roles > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
                      <span>Deal Conversion</span>
                      <span>
                        {client.total_roles > 0 
                          ? `${((client.deals / client.total_roles) * 100).toFixed(1)}%` 
                          : '0%'}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${client.total_roles > 0 ? (client.deals / client.total_roles) * 100 : 0}%` 
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Role Aging & SLA */}
      {agingMetrics && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Role Aging & SLA
                </h2>
                <p className="text-sm text-slate-600 mt-1">How long roles are open and responsiveness metrics</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs text-slate-500 mb-1">Avg Days Open</div>
                <div className="text-2xl font-bold text-slate-800">{agingMetrics.avg_days_open}</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <div className="text-xs text-red-600 mb-1">Roles ≥14d</div>
                <div className="text-2xl font-bold text-red-700">{agingMetrics.roles_over_14}</div>
              </div>
              <div className="bg-red-100 rounded-lg p-3">
                <div className="text-xs text-red-700 mb-1">Roles ≥30d</div>
                <div className="text-2xl font-bold text-red-800">{agingMetrics.roles_over_30}</div>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3">
                <div className="text-xs text-emerald-600 mb-1">Avg Time to 1st Submission (days)</div>
                <div className="text-2xl font-bold text-emerald-700">{agingMetrics.avg_time_to_first_submission}</div>
              </div>
              <div className="bg-indigo-50 rounded-lg p-3">
                <div className="text-xs text-indigo-600 mb-1">Avg Time to 1st Interview (days)</div>
                <div className="text-2xl font-bold text-indigo-700">{agingMetrics.avg_time_to_first_interview}</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Role</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Days Open</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">1st Submission</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">1st Interview</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {agingRoles.slice(0, 8).map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">{r.title}</span>
                          <span className="text-xs text-slate-500 font-mono">{r.role_code}</span>
                          {r.has_dropout && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded border border-red-200">Dropped Out</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-slate-800 font-medium">{r.days_open}</td>
                      <td className="px-4 py-2 text-slate-700">{r.first_submission_days ?? '—'}</td>
                      <td className="px-4 py-2 text-slate-700">{r.first_interview_days ?? '—'}</td>
                      <td className="px-4 py-2">
                        <span className="px-2 py-1 rounded-full text-xs font-semibold border">
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Target className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-sm text-slate-600">Total Roles</div>
          </div>
          <div className="text-3xl font-bold text-slate-800">
            {clients.reduce((sum, c) => sum + c.total_roles, 0)}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-sm text-slate-600">Total Deals</div>
          </div>
          <div className="text-3xl font-bold text-green-700">
            {clients.reduce((sum, c) => sum + c.deals, 0)}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div className="text-sm text-slate-600">Total Interviews</div>
          </div>
          <div className="text-3xl font-bold text-purple-700">
            {clients.reduce((sum, c) => sum + c.interviews, 0)}
          </div>
        </div>
      </div>
    </div>
  );
}
