import { useState, useEffect } from 'react';
import { X, Briefcase, Building2, Users, User } from 'lucide-react';
import { fetchWithAuth } from '@/react-app/utils/api';

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

interface AccountManager {
  id: number;
  name: string;
  user_code: string;
}

interface Recruiter {
  id: number;
  name: string;
  user_code: string;
  team_id?: number;
  team_name?: string;
}

interface CreateRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateRoleModal({ isOpen, onClose, onSuccess }: CreateRoleModalProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [accountManagers, setAccountManagers] = useState<AccountManager[]>([]);
  const [recruiters, setRecruiters] = useState<Recruiter[]>([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    client_id: '',
    team_ids: [] as number[],
    title: '',
    description: '',
    account_manager_id: '',
    recruiter_ids: [] as number[]
  });

  useEffect(() => {
    if (isOpen) {
      fetchInitialData();
    }
  }, [isOpen]);

  const fetchInitialData = async () => {
    try {
      const [clientsRes, teamsRes, amsRes, recruitersRes] = await Promise.all([
        fetchWithAuth('/api/rm/clients'),
        fetchWithAuth('/api/rm/teams'),
        fetchWithAuth('/api/rm/account-managers'),
        fetchWithAuth('/api/rm/recruiters')
      ]);

      if (clientsRes.ok) setClients(await clientsRes.json());
      if (teamsRes.ok) setTeams(await teamsRes.json());
      if (amsRes.ok) setAccountManagers(await amsRes.json());
      if (recruitersRes.ok) setRecruiters(await recruitersRes.json());
    } catch (error) {
      console.error('Failed to fetch initial data:', error);
    }
  };

  const handleTeamToggle = (teamId: number) => {
    setFormData(prev => ({
      ...prev,
      team_ids: prev.team_ids.includes(teamId)
        ? prev.team_ids.filter(id => id !== teamId)
        : [...prev.team_ids, teamId]
    }));
  };

  const handleRecruiterToggle = (recruiterId: number) => {
    setFormData(prev => ({
      ...prev,
      recruiter_ids: prev.recruiter_ids.includes(recruiterId)
        ? prev.recruiter_ids.filter(id => id !== recruiterId)
        : [...prev.recruiter_ids, recruiterId]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.client_id || formData.team_ids.length === 0 || !formData.title || !formData.account_manager_id) {
      alert('Please fill in all required fields and select at least one team');
      return;
    }

    setLoading(true);

    try {
      const response = await fetchWithAuth('/api/rm/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: parseInt(formData.client_id),
          team_ids: formData.team_ids,
          title: formData.title,
          description: formData.description,
          account_manager_id: parseInt(formData.account_manager_id)
        })
      });

      if (response.ok) {
        const data = await response.json();
        const roleId = data.role_id;

        // Assign recruiters if any selected
        if (formData.recruiter_ids.length > 0) {
          await fetchWithAuth(`/api/rm/roles/${roleId}/recruiters`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recruiter_ids: formData.recruiter_ids
            })
          });
        }

        onSuccess();
        handleClose();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create role');
      }
    } catch (error) {
      console.error('Error creating role:', error);
      alert('Failed to create role');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      client_id: '',
      team_ids: [],
      title: '',
      description: '',
      account_manager_id: '',
      recruiter_ids: []
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-indigo-700 px-8 py-6 flex items-center justify-between text-white z-10">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-xl p-2">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-bold">Create New Role</h3>
              <p className="text-indigo-100 text-sm mt-0.5">Add a new role and assign to teams</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 overflow-y-auto max-h-[calc(90vh-180px)]">
          <div className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Role Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="e.g., Senior Software Engineer"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
                placeholder="Optional role description..."
              />
            </div>

            {/* Client */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                <Building2 className="w-4 h-4 inline mr-1" />
                Client <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all appearance-none bg-white"
              >
                <option value="">Select a client</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.name} ({client.client_code})
                  </option>
                ))}
              </select>
            </div>

            {/* Teams */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                <Users className="w-4 h-4 inline mr-1" />
                Assign to Teams <span className="text-red-500">*</span>
              </label>
              <p className="text-sm text-slate-500 mb-3">Select one or more teams for this role</p>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-4">
                {teams.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">No teams available</p>
                ) : (
                  teams.map(team => (
                    <label
                      key={team.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        formData.team_ids.includes(team.id)
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.team_ids.includes(team.id)}
                        onChange={() => handleTeamToggle(team.id)}
                        className="w-5 h-5 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-slate-800">{team.name}</p>
                        <p className="text-sm text-slate-500 font-mono">{team.team_code}</p>
                      </div>
                    </label>
                  ))
                )}
              </div>
              {formData.team_ids.length > 0 && (
                <p className="text-sm text-indigo-600 mt-2">
                  {formData.team_ids.length} team{formData.team_ids.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>

            {/* Account Manager */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                <User className="w-4 h-4 inline mr-1" />
                Account Manager <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.account_manager_id}
                onChange={(e) => setFormData({ ...formData, account_manager_id: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all appearance-none bg-white"
              >
                <option value="">Select an account manager</option>
                {accountManagers.map(am => (
                  <option key={am.id} value={am.id}>
                    {am.name} ({am.user_code})
                  </option>
                ))}
              </select>
            </div>

            {/* Recruiters */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                <Users className="w-4 h-4 inline mr-1" />
                Assign to Recruiters (Optional)
              </label>
              <p className="text-sm text-slate-500 mb-3">Select recruiters to work on this role</p>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-4">
                {recruiters.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">No recruiters available</p>
                ) : (
                  recruiters.map(recruiter => (
                    <label
                      key={recruiter.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        formData.recruiter_ids.includes(recruiter.id)
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.recruiter_ids.includes(recruiter.id)}
                        onChange={() => handleRecruiterToggle(recruiter.id)}
                        className="w-5 h-5 text-emerald-600 rounded focus:ring-2 focus:ring-emerald-500"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-slate-800">{recruiter.name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-slate-500 font-mono">{recruiter.user_code}</p>
                          {recruiter.team_name && (
                            <span className="text-xs text-slate-400">• {recruiter.team_name}</span>
                          )}
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
              {formData.recruiter_ids.length > 0 && (
                <p className="text-sm text-emerald-600 mt-2">
                  {formData.recruiter_ids.length} recruiter{formData.recruiter_ids.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-8 py-4 flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 px-6 py-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create Role'}
          </button>
        </div>
      </div>
    </div>
  );
}
