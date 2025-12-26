import { useState, useEffect } from 'react';
import { X, UserPlus, Briefcase, User, Plus, Trash2, Users } from 'lucide-react';
import { fetchWithAuth } from '@/react-app/utils/api';

interface Role {
  id: number;
  role_code: string;
  title: string;
  client_name: string;
  team_name: string;
}

interface Recruiter {
  id: number;
  name: string;
  user_code: string;
  team_name?: string;
}

interface Assignment {
  id: number;
  role_id: number;
  role_code: string;
  role_title: string;
  recruiter_id: number;
  recruiter_name: string;
  recruiter_code: string;
  assigned_at: string;
}

interface AssignRecruiterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AssignRecruiterModal({ isOpen, onClose, onSuccess }: AssignRecruiterModalProps) {
  const [activeRoles, setActiveRoles] = useState<Role[]>([]);
  const [recruiters, setRecruiters] = useState<Recruiter[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedRecruiterIds, setSelectedRecruiterIds] = useState<string[]>(['']);
  const [assignToAll, setAssignToAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rolesRes, recruitersRes, assignmentsRes] = await Promise.all([
        fetchWithAuth('/api/rm/roles?status=active'),
        fetchWithAuth('/api/rm/recruiters'),
        fetchWithAuth('/api/rm/recruiter-assignments')
      ]);

      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setActiveRoles(rolesData);
      }
      if (recruitersRes.ok) {
        const recruitersData = await recruitersRes.json();
        setRecruiters(recruitersData);
      }
      if (assignmentsRes.ok) {
        const assignmentsData = await assignmentsRes.json();
        setAssignments(assignmentsData);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRecruiter = () => {
    setSelectedRecruiterIds([...selectedRecruiterIds, '']);
  };

  const handleRemoveRecruiterSlot = (index: number) => {
    if (selectedRecruiterIds.length > 1) {
      setSelectedRecruiterIds(selectedRecruiterIds.filter((_, i) => i !== index));
    }
  };

  const handleRecruiterChange = (index: number, value: string) => {
    const newIds = [...selectedRecruiterIds];
    newIds[index] = value;
    setSelectedRecruiterIds(newIds);
  };

  const handleAssign = async () => {
    if (!selectedRoleId) {
      alert('Please select a role');
      return;
    }

    let recruiterIdsToAssign: string[] = [];
    
    if (assignToAll) {
      // Assign to all available recruiters
      recruiterIdsToAssign = recruiters.map(r => String(r.id));
    } else {
      // Assign to selected recruiters only
      recruiterIdsToAssign = selectedRecruiterIds.filter(id => id !== '');
    }

    if (recruiterIdsToAssign.length === 0) {
      alert('Please select at least one recruiter or enable "Assign to All"');
      return;
    }

    setSubmitting(true);
    try {
      // Assign each recruiter to the role
      const promises = recruiterIdsToAssign.map(recruiterId =>
        fetchWithAuth('/api/rm/assign-recruiter-to-role', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role_id: parseInt(selectedRoleId),
            recruiter_id: parseInt(recruiterId)
          })
        })
      );

      const results = await Promise.all(promises);
      
      // Check if all assignments succeeded
      const allSucceeded = results.every(r => r.ok);
      
      if (allSucceeded) {
        setSelectedRoleId('');
        setSelectedRecruiterIds(['']);
        setAssignToAll(false);
        await fetchData(); // Refresh assignments
        onSuccess();
      } else {
        // Get error messages from failed requests
        const errors = await Promise.all(
          results.map(async (r, i) => {
            if (!r.ok) {
              const error = await r.json();
              return `Recruiter ${i + 1}: ${error.error || 'Failed'}`;
            }
            return null;
          })
        );
        const errorMessages = errors.filter(e => e !== null).join('\n');
        alert(`Some assignments failed:\n${errorMessages}`);
        
        // Refresh to show successful assignments
        await fetchData();
      }
    } catch (error) {
      console.error('Error assigning recruiters:', error);
      alert('Failed to assign recruiters');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: number) => {
    if (!confirm('Are you sure you want to remove this assignment?')) {
      return;
    }

    try {
      const response = await fetchWithAuth(`/api/rm/recruiter-assignments/${assignmentId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchData(); // Refresh assignments
        onSuccess();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to remove assignment');
      }
    } catch (error) {
      console.error('Error removing assignment:', error);
      alert('Failed to remove assignment');
    }
  };

  const handleClose = () => {
    setSelectedRoleId('');
    setSelectedRecruiterIds(['']);
    setAssignToAll(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-emerald-600 to-emerald-700 px-8 py-6 flex items-center justify-between text-white z-10">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-xl p-2">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-bold">Assign to Recruiter</h3>
              <p className="text-emerald-100 text-sm mt-0.5">Assign active roles to recruiters for active work tracking</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 overflow-y-auto max-h-[calc(90vh-200px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent"></div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Assignment Form */}
              <div className="bg-gradient-to-br from-emerald-50 to-white border-2 border-emerald-200 rounded-2xl p-6">
                <h4 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-emerald-600" />
                  Create New Assignment
                </h4>
                
                {/* Role Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <Briefcase className="w-4 h-4 inline mr-1" />
                    Select Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedRoleId}
                    onChange={(e) => setSelectedRoleId(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all appearance-none bg-white"
                  >
                    <option value="">Select an active role</option>
                    {activeRoles.map(role => (
                      <option key={role.id} value={role.id}>
                        {role.role_code} - {role.title} ({role.client_name})
                      </option>
                    ))}
                  </select>
                  {activeRoles.length === 0 && (
                    <p className="text-sm text-slate-500 mt-1">No active roles available</p>
                  )}
                </div>

                {/* Recruiters Selection */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-semibold text-slate-700">
                      <User className="w-4 h-4 inline mr-1" />
                      Select Recruiter(s) <span className="text-red-500">*</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={assignToAll}
                        onChange={(e) => setAssignToAll(e.target.checked)}
                        className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                      />
                      <span className="text-sm font-semibold text-emerald-700">Assign to All</span>
                    </label>
                  </div>

                  {assignToAll ? (
                    <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <div className="bg-emerald-100 rounded-lg p-2 mt-0.5">
                          <Users className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-emerald-900 mb-1">
                            Assigning to All Recruiters
                          </p>
                          <p className="text-sm text-emerald-700 mb-2">
                            This role will be assigned to all {recruiters.length} available recruiter{recruiters.length !== 1 ? 's' : ''}.
                          </p>
                          <div className="bg-white rounded-lg p-3 max-h-32 overflow-y-auto">
                            <div className="space-y-1.5">
                              {recruiters.map(recruiter => (
                                <div key={recruiter.id} className="flex items-center gap-2 text-sm">
                                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                                  <span className="font-medium text-slate-700">{recruiter.name}</span>
                                  <span className="text-slate-500">({recruiter.user_code})</span>
                                  {recruiter.team_name && (
                                    <span className="text-xs text-slate-400">- {recruiter.team_name}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {selectedRecruiterIds.map((recruiterId, index) => (
                        <div key={index} className="flex gap-2">
                          <select
                            value={recruiterId}
                            onChange={(e) => handleRecruiterChange(index, e.target.value)}
                            className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all appearance-none bg-white"
                          >
                            <option value="">Select a recruiter</option>
                            {recruiters.map(recruiter => (
                              <option key={recruiter.id} value={recruiter.id}>
                                {recruiter.name} ({recruiter.user_code}){recruiter.team_name ? ` - ${recruiter.team_name}` : ''}
                              </option>
                            ))}
                          </select>
                          {selectedRecruiterIds.length > 1 && (
                            <button
                              onClick={() => handleRemoveRecruiterSlot(index)}
                              className="px-3 py-2 bg-red-100 text-red-700 rounded-xl hover:bg-red-200 transition-colors"
                              title="Remove this recruiter slot"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      ))}

                      {recruiters.length === 0 && (
                        <p className="text-sm text-slate-500 mt-1">No recruiters available</p>
                      )}

                      {/* Add Another Recruiter Button */}
                      <button
                        onClick={handleAddRecruiter}
                        disabled={recruiters.length === 0}
                        className="w-full px-4 py-3 border-2 border-dashed border-emerald-300 text-emerald-700 rounded-xl hover:bg-emerald-50 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <Plus className="w-5 h-5" />
                        Add Another Recruiter
                      </button>
                    </>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  onClick={handleAssign}
                  disabled={submitting || !selectedRoleId || (!assignToAll && selectedRecruiterIds.filter(id => id !== '').length === 0)}
                  className="w-full px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
                >
                  <Plus className="w-5 h-5" />
                  {submitting ? 'Assigning...' : assignToAll ? `Assign to All ${recruiters.length} Recruiter(s)` : `Assign ${selectedRecruiterIds.filter(id => id !== '').length} Recruiter(s) to Role`}
                </button>
              </div>

              {/* Current Assignments */}
              <div>
                <h4 className="text-lg font-bold text-slate-800 mb-4">Current Assignments</h4>
                {assignments.length === 0 ? (
                  <div className="bg-slate-50 rounded-2xl p-8 text-center border-2 border-dashed border-slate-200">
                    <UserPlus className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">No assignments yet. Create your first assignment above.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {assignments.map(assignment => (
                      <div
                        key={assignment.id}
                        className="bg-white border-2 border-slate-200 rounded-xl p-4 hover:border-emerald-300 hover:shadow-md transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Role</p>
                              <p className="font-semibold text-slate-800">
                                {assignment.role_code} - {assignment.role_title}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Recruiter</p>
                              <p className="font-semibold text-slate-800">
                                {assignment.recruiter_name} ({assignment.recruiter_code})
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveAssignment(assignment.id)}
                            className="ml-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-medium text-sm transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">
                          Assigned: {new Date(assignment.assigned_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-8 py-4">
          <button
            onClick={handleClose}
            className="w-full px-6 py-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
