import { useState, useEffect } from 'react';
import { Settings, Info, Users, Target, Building2, UsersRound, BarChart3 } from 'lucide-react';
import { fetchWithAuth } from '@/react-app/utils/api';

export default function AdminSettings() {
  const [showCompanyPage, setShowCompanyPage] = useState(true);
  const [showEmployeeProfiles, setShowEmployeeProfiles] = useState(true);
  const [showRecruiterStats, setShowRecruiterStats] = useState(true);
  const [showRMStats, setShowRMStats] = useState(true);
  const [showAMStats, setShowAMStats] = useState(true);
  const [showClientStats, setShowClientStats] = useState(true);
  const [showTeamStats, setShowTeamStats] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetchWithAuth('/api/company/settings');
      if (response.ok) {
        const data = await response.json();
        setShowCompanyPage(data.show_company_page);
      }

      // Fetch employee profile settings
      const profileResponse = await fetchWithAuth('/api/admin/profile-settings');
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        setShowEmployeeProfiles(profileData.show_employee_profiles);
        setShowRecruiterStats(profileData.show_recruiter_stats);
        setShowRMStats(profileData.show_rm_stats);
        setShowAMStats(profileData.show_am_stats);
        setShowClientStats(profileData.show_client_stats);
        setShowTeamStats(profileData.show_team_stats);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  const handleCompanyPageToggle = async () => {
    try {
      setSaving(true);
      const newValue = !showCompanyPage;
      
      const response = await fetchWithAuth('/api/company/settings', {
        method: 'PUT',
        body: JSON.stringify({ show_company_page: newValue })
      });

      if (response.ok) {
        setShowCompanyPage(newValue);
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to update settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleEmployeeProfilesToggle = async () => {
    try {
      setSaving(true);
      const newValue = !showEmployeeProfiles;
      
      const response = await fetchWithAuth('/api/admin/profile-settings', {
        method: 'PUT',
        body: JSON.stringify({ 
          show_employee_profiles: newValue,
          // If turning off main toggle, turn off all sub-toggles
          show_recruiter_stats: newValue ? showRecruiterStats : false,
          show_rm_stats: newValue ? showRMStats : false,
          show_am_stats: newValue ? showAMStats : false,
          show_client_stats: newValue ? showClientStats : false,
          show_team_stats: newValue ? showTeamStats : false,
        })
      });

      if (response.ok) {
        setShowEmployeeProfiles(newValue);
        if (!newValue) {
          // Turn off all sub-toggles
          setShowRecruiterStats(false);
          setShowRMStats(false);
          setShowAMStats(false);
          setShowClientStats(false);
          setShowTeamStats(false);
        }
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to update settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleStatToggle = async (settingKey: string, currentValue: boolean) => {
    try {
      setSaving(true);
      const newValue = !currentValue;
      
      const response = await fetchWithAuth('/api/admin/profile-settings', {
        method: 'PUT',
        body: JSON.stringify({ 
          show_employee_profiles: showEmployeeProfiles,
          show_recruiter_stats: settingKey === 'show_recruiter_stats' ? newValue : showRecruiterStats,
          show_rm_stats: settingKey === 'show_rm_stats' ? newValue : showRMStats,
          show_am_stats: settingKey === 'show_am_stats' ? newValue : showAMStats,
          show_client_stats: settingKey === 'show_client_stats' ? newValue : showClientStats,
          show_team_stats: settingKey === 'show_team_stats' ? newValue : showTeamStats,
        })
      });

      if (response.ok) {
        // Update the specific setting
        switch (settingKey) {
          case 'show_recruiter_stats':
            setShowRecruiterStats(newValue);
            break;
          case 'show_rm_stats':
            setShowRMStats(newValue);
            break;
          case 'show_am_stats':
            setShowAMStats(newValue);
            break;
          case 'show_client_stats':
            setShowClientStats(newValue);
            break;
          case 'show_team_stats':
            setShowTeamStats(newValue);
            break;
        }
      }
    } catch (error) {
      console.error('Failed to update settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const ToggleSwitch = ({ enabled, onClick, disabled = false }: { enabled: boolean; onClick: () => void; disabled?: boolean }) => (
    <button
      onClick={onClick}
      disabled={disabled || saving}
      className={`relative inline-flex items-center h-8 w-16 rounded-full transition-colors ${
        enabled ? 'bg-emerald-500' : 'bg-slate-300'
      } ${disabled || saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block w-6 h-6 transform rounded-full bg-white shadow-lg transition-transform ${
          enabled ? 'translate-x-9' : 'translate-x-1'
        }`}
      />
    </button>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-800">Settings</h2>
        <p className="text-slate-500 mt-1">Manage application settings and visibility controls</p>
      </div>

      {/* Company Page Visibility */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">Company Page Visibility</h3>
            <p className="text-sm text-slate-500">Control access to the Company Page for all users</p>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h4 className="text-lg font-semibold text-slate-800 mb-2">Show Company Page to Users</h4>
              <p className="text-sm text-slate-600 mb-1">
                When enabled, the Company Page option will be visible in the side menu for all users.
              </p>
              <p className="text-sm text-slate-600">
                When disabled, the Company Page option will be hidden from all users.
              </p>
            </div>

            <ToggleSwitch enabled={showCompanyPage} onClick={handleCompanyPageToggle} />
          </div>

          <div className="mt-6 pt-6 border-t border-slate-200">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${showCompanyPage ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
              <span className="text-sm font-medium text-slate-700">
                Current Status: {showCompanyPage ? 'Visible to All Users' : 'Hidden from All Users'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Employee Profiles Visibility */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">Employee Profiles & Statistics</h3>
            <p className="text-sm text-slate-500">Control what users can see about other employees</p>
          </div>
        </div>

        {/* Main Toggle */}
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-6 border-2 border-blue-200 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h4 className="text-lg font-semibold text-slate-800 mb-2 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Show Employee Profiles
              </h4>
              <p className="text-sm text-slate-600">
                Master control for employee profile visibility. When disabled, all profile features are hidden from users.
              </p>
            </div>

            <ToggleSwitch enabled={showEmployeeProfiles} onClick={handleEmployeeProfilesToggle} />
          </div>
        </div>

        {/* Sub-toggles */}
        <div className={`space-y-4 transition-opacity ${showEmployeeProfiles ? 'opacity-100' : 'opacity-50'}`}>
          <p className="text-sm font-semibold text-slate-700 mb-4">
            Configure what statistics are visible in employee profiles:
          </p>

          {/* Recruiter Stats */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Target className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h5 className="font-semibold text-slate-800">Recruiter Statistics</h5>
                  <p className="text-sm text-slate-600">Show EBES scores, submissions, interviews, and deals</p>
                </div>
              </div>
              <ToggleSwitch 
                enabled={showRecruiterStats} 
                onClick={() => handleStatToggle('show_recruiter_stats', showRecruiterStats)}
                disabled={!showEmployeeProfiles}
              />
            </div>
          </div>

          {/* RM Stats */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h5 className="font-semibold text-slate-800">Recruitment Manager Statistics</h5>
                  <p className="text-sm text-slate-600">Show EBES scores, team performance, and analytics</p>
                </div>
              </div>
              <ToggleSwitch 
                enabled={showRMStats} 
                onClick={() => handleStatToggle('show_rm_stats', showRMStats)}
                disabled={!showEmployeeProfiles}
              />
            </div>
          </div>

          {/* AM Stats */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h5 className="font-semibold text-slate-800">Account Manager Statistics</h5>
                  <p className="text-sm text-slate-600">Show EBES scores, roles, interviews, and conversions</p>
                </div>
              </div>
              <ToggleSwitch 
                enabled={showAMStats} 
                onClick={() => handleStatToggle('show_am_stats', showAMStats)}
                disabled={!showEmployeeProfiles}
              />
            </div>
          </div>

          {/* Client Stats */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h5 className="font-semibold text-slate-800">Client Information</h5>
                  <p className="text-sm text-slate-600">Show assigned clients and client performance data</p>
                </div>
              </div>
              <ToggleSwitch 
                enabled={showClientStats} 
                onClick={() => handleStatToggle('show_client_stats', showClientStats)}
                disabled={!showEmployeeProfiles}
              />
            </div>
          </div>

          {/* Team Stats */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                  <UsersRound className="w-5 h-5 text-pink-600" />
                </div>
                <div>
                  <h5 className="font-semibold text-slate-800">Team Information</h5>
                  <p className="text-sm text-slate-600">Show team assignments and team performance metrics</p>
                </div>
              </div>
              <ToggleSwitch 
                enabled={showTeamStats} 
                onClick={() => handleStatToggle('show_team_stats', showTeamStats)}
                disabled={!showEmployeeProfiles}
              />
            </div>
          </div>
        </div>

        {/* Status Summary */}
        <div className="mt-6 pt-6 border-t border-slate-200">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${showEmployeeProfiles ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
              <span className="text-sm font-medium text-slate-700">
                Profiles: {showEmployeeProfiles ? 'On' : 'Off'}
              </span>
            </div>
            {showEmployeeProfiles && (
              <>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${showRecruiterStats ? 'bg-blue-500' : 'bg-slate-300'}`}></div>
                  <span className="text-sm text-slate-600">Recruiter Stats</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${showRMStats ? 'bg-purple-500' : 'bg-slate-300'}`}></div>
                  <span className="text-sm text-slate-600">RM Stats</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${showAMStats ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                  <span className="text-sm text-slate-600">AM Stats</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${showClientStats ? 'bg-orange-500' : 'bg-slate-300'}`}></div>
                  <span className="text-sm text-slate-600">Client Info</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${showTeamStats ? 'bg-pink-500' : 'bg-slate-300'}`}></div>
                  <span className="text-sm text-slate-600">Team Info</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Info className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-blue-900 mb-1">Important Notes</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Changes take effect immediately for all users</li>
              <li>• When the main "Employee Profiles" toggle is off, all sub-features are disabled</li>
              <li>• Users can only see profiles and stats of other employees, not admins</li>
              <li>• Individual stat toggles can be controlled independently when profiles are enabled</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
