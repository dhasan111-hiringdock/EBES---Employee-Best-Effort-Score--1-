import { useState, useEffect } from "react";
import { Search, Users, Target, BarChart3, Building2, UsersRound, Award, Mail, Calendar, Briefcase } from "lucide-react";
import { fetchWithAuth } from "@/react-app/utils/api";

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

export default function EmployeeProfiles() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  useEffect(() => {
    fetchProfiles();
  }, [searchQuery, roleFilter]);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (roleFilter !== "all") params.append("role", roleFilter);

      const response = await fetchWithAuth(`/api/employees/profiles?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.profiles);
        setSettings(data.settings);
      }
    } catch (error) {
      console.error("Failed to fetch employee profiles:", error);
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

  // Show loading state while fetching settings and profiles
  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Only show disabled message after settings are confirmed loaded
  if (!settings.show_employee_profiles) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl border-2 border-slate-200 p-12 max-w-md text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Users className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">Employee Profiles Disabled</h2>
          <p className="text-slate-600">
            Employee profiles are currently disabled by the administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          Employee Directory
        </h2>
        <p className="text-slate-600 mt-1">View profiles and performance statistics of team members</p>
      </div>

      {/* Filters */}
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

      {/* Employee Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {employees.map((employee) => {
          const RoleIcon = getRoleIcon(employee.role);
          const hasStats = employee.stats && (
            (employee.role === 'recruiter' && settings.show_recruiter_stats) ||
            (employee.role === 'account_manager' && settings.show_am_stats) ||
            (employee.role === 'recruitment_manager' && settings.show_rm_stats)
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
                {settings.show_team_stats && employee.teams && employee.teams.length > 0 && (
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

                {settings.show_client_stats && employee.clients && employee.clients.length > 0 && (
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
              {settings.show_recruiter_stats && <li>• Recruiter performance metrics are visible</li>}
              {settings.show_am_stats && <li>• Account Manager statistics are visible</li>}
              {settings.show_rm_stats && <li>• Recruitment Manager data is visible</li>}
              {settings.show_client_stats && <li>• Client assignments are visible</li>}
              {settings.show_team_stats && <li>• Team assignments are visible</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
