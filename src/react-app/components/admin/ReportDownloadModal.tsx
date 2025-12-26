import { useState } from "react";
import { X, Download, FileText, FileSpreadsheet } from "lucide-react";

interface ReportDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  teams: Array<{ id: number; name: string; team_code: string }>;
  clients: Array<{ id: number; name: string; client_code: string }>;
  onDownload: (filters: ReportFilters, format: 'csv' | 'excel' | 'pdf') => void;
  allowedRoles?: Array<'admin' | 'account_manager' | 'recruitment_manager' | 'recruiter'>;
}

export interface ReportFilters {
  role: string;
  teamId: string;
  clientId: string;
  performanceLevel: string;
  dateRange: string;
  startDate: string;
  endDate: string;
  searchTerm: string;
  fields: string[];
}

export default function ReportDownloadModal({
  isOpen,
  onClose,
  teams,
  clients,
  onDownload,
  allowedRoles,
}: ReportDownloadModalProps) {
  const [format, setFormat] = useState<'csv' | 'excel' | 'pdf'>('csv');
  const defaultRole = (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes('admin'))
    ? allowedRoles[0]
    : 'all';
  const [role, setRole] = useState(defaultRole);
  const [teamId, setTeamId] = useState('all');
  const [clientId, setClientId] = useState('all');
  const [performanceLevel, setPerformanceLevel] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [fields, setFields] = useState<string[]>([
    'user_info',
    'ebes_score',
    'cv_quality_average',
    'cv_quality_label',
    'teams',
    'clients',
    'total_roles',
    'active_roles',
    'non_active_roles',
    'submissions',
    'interviews_1',
    'interviews_2',
    'total_interviews',
    'deals',
    'dropouts',
    'lost_roles',
    'on_hold_roles',
    'no_answer_roles',
    'managed_teams',
    'total_recruiters',
    'client_breakdown',
    'team_breakdown',
    'daily_trend',
    'monthly_trend',
    'roles_to_interviews_pct',
    'interviews_to_deals_pct',
    'stage_1_to_2_dropoff_pct',
    'submission_6h_pct',
    'submission_24h_pct',
    'submission_after_24h_pct',
    'dropout_rate_pct',
    'active_roles_pct',
    'rm_ebes_table1_points',
    'rm_ebes_table2_points',
    'recruiter_ebes_table1_points',
    'recruiter_ebes_table2_points',
  ]);

  if (!isOpen) return null;

  const handleDownload = () => {
    const filters: ReportFilters = {
      role,
      teamId,
      clientId,
      performanceLevel,
      dateRange,
      startDate,
      endDate,
      searchTerm,
      fields,
    };
    onDownload(filters, format);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-4 rounded-t-2xl flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Download Performance Report</h2>
            <p className="text-indigo-100 text-sm mt-1">
              Configure filters and select format for your report
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Format Selection */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border-2 border-indigo-200">
            <label className="block text-sm font-bold text-gray-900 mb-3">
              Select Report Format
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setFormat('csv')}
                className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                  format === 'csv'
                    ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                    : 'border-gray-200 bg-white hover:border-indigo-300'
                }`}
              >
                <FileText className={`w-6 h-6 ${format === 'csv' ? 'text-indigo-600' : 'text-gray-400'}`} />
                <div className="text-left">
                  <p className={`font-semibold ${format === 'csv' ? 'text-indigo-900' : 'text-gray-700'}`}>
                    CSV Format
                  </p>
                  <p className="text-xs text-gray-500">Best for Excel, Google Sheets</p>
                </div>
              </button>
              <button
                onClick={() => setFormat('excel')}
                className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                  format === 'excel'
                    ? 'border-green-600 bg-green-50 shadow-lg'
                    : 'border-gray-200 bg-white hover:border-green-300'
                }`}
              >
                <FileSpreadsheet className={`w-6 h-6 ${format === 'excel' ? 'text-green-600' : 'text-gray-400'}`} />
                <div className="text-left">
                  <p className={`font-semibold ${format === 'excel' ? 'text-green-900' : 'text-gray-700'}`}>
                    Excel Format
                  </p>
                  <p className="text-xs text-gray-500">Native .xlsx file with formatting</p>
                </div>
              </button>
              <button
                onClick={() => setFormat('pdf')}
                className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                  format === 'pdf'
                    ? 'border-red-600 bg-red-50 shadow-lg'
                    : 'border-gray-200 bg-white hover:border-red-300'
                }`}
              >
                <FileText className={`w-6 h-6 ${format === 'pdf' ? 'text-red-600' : 'text-gray-400'}`} />
                <div className="text-left">
                  <p className={`font-semibold ${format === 'pdf' ? 'text-red-900' : 'text-gray-700'}`}>
                    PDF Format
                  </p>
                  <p className="text-xs text-gray-500">Printable report for sharing</p>
                </div>
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Report Filters
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Role Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  User Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                >
                  {((allowedRoles && allowedRoles.includes('admin')) || !allowedRoles) && (
                    <option value="all">All Roles</option>
                  )}
                  {((allowedRoles && allowedRoles.includes('recruiter')) || !allowedRoles) && (
                    <option value="recruiter">Recruiter</option>
                  )}
                  {((allowedRoles && allowedRoles.includes('account_manager')) || !allowedRoles) && (
                    <option value="account_manager">Account Manager</option>
                  )}
                  {((allowedRoles && allowedRoles.includes('recruitment_manager')) || !allowedRoles) && (
                    <option value="recruitment_manager">Recruitment Manager</option>
                  )}
                  {((allowedRoles && allowedRoles.includes('admin')) || !allowedRoles) && (
                    <option value="admin">Admin</option>
                  )}
                </select>
              </div>

              {/* Performance Level Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Performance Level
                </label>
                <select
                  value={performanceLevel}
                  onChange={(e) => setPerformanceLevel(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                >
                  <option value="all">All Levels</option>
                  <option value="Excellent">Excellent (80-100)</option>
                  <option value="Good">Good (60-79)</option>
                  <option value="Average">Average (40-59)</option>
                  <option value="Needs Improvement">Needs Improvement (&lt;40)</option>
                </select>
              </div>

              {/* Team Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Team
                </label>
                <select
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client
                </label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date Range
                </label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>

              {/* Search Term */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search User
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Name, email, or code..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Custom Date Range */}
              {dateRange === 'custom' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border-2 border-green-200">
            <h3 className="font-bold text-gray-900 mb-3">Select Report Fields</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              { [
                { key: 'user_info', label: 'User Information' },
                { key: 'ebes_score', label: 'EBES Score' },
                { key: 'cv_quality_average', label: 'CV Quality Avg' },
                { key: 'cv_quality_label', label: 'CV Quality Label' },
                { key: 'teams', label: 'Teams' },
                { key: 'clients', label: 'Clients' },
                { key: 'total_roles', label: 'Total Roles' },
                { key: 'active_roles', label: 'Active Roles' },
                { key: 'non_active_roles', label: 'Non-Active Roles' },
                { key: 'submissions', label: 'Submissions' },
                { key: 'interviews_1', label: 'Interview Round 1' },
                { key: 'interviews_2', label: 'Interview Round 2' },
                
                { key: 'total_interviews', label: 'Total Interviews' },
                { key: 'deals', label: 'Deals' },
                { key: 'dropouts', label: 'Dropouts' },
                { key: 'lost_roles', label: 'Lost Roles' },
                { key: 'on_hold_roles', label: 'On Hold Roles' },
                { key: 'no_answer_roles', label: 'No Answer Roles' },
                { key: 'managed_teams', label: 'Teams Managed' },
                { key: 'total_recruiters', label: 'Recruiters' },
                { key: 'client_breakdown', label: 'Client Breakdown' },
                { key: 'team_breakdown', label: 'Team Breakdown' },
                { key: 'daily_trend', label: 'Daily Trend' },
                { key: 'monthly_trend', label: 'Monthly Trend' },
                { key: 'roles_to_interviews_pct', label: 'Roles → Interviews %' },
                { key: 'interviews_to_deals_pct', label: 'Interviews → Deals %' },
                { key: 'stage_1_to_2_dropoff_pct', label: 'Stage 1→2 Drop-off %' },
                
                { key: 'submission_6h_pct', label: '6h Submissions %' },
                { key: 'submission_24h_pct', label: '24h Submissions %' },
                { key: 'submission_after_24h_pct', label: 'After 24h Submissions %' },
                { key: 'dropout_rate_pct', label: 'Dropout Rate %' },
                { key: 'active_roles_pct', label: 'Active Roles %' },
                
              ].map((f) => (
                <label key={f.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={fields.includes(f.key)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFields((prev) => {
                        if (checked) return Array.from(new Set([...prev, f.key]));
                        return prev.filter((k) => k !== f.key);
                      });
                    }}
                  />
                  <span>{f.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-6 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleDownload}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg transition-all font-medium shadow-lg flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
