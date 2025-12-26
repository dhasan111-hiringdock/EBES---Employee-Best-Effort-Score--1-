import { useState, useEffect } from "react";
import { Users, Search, UserCheck, UserX, Eye, Trash2, RotateCcw, Briefcase, Edit } from "lucide-react";
import { fetchWithAuth } from "@/react-app/utils/api";
import EditCandidateModal from "@/react-app/components/recruiter/EditCandidateModal";

interface Candidate {
  id: number;
  candidate_code: string;
  name: string;
  email: string;
  phone: string;
  resume_url: string;
  notes: string;
  is_active: number;
  created_at: string;
  total_associations: number;
  active_associations: number;
  discarded_associations: number;
}

interface Association {
  id: number;
  role_code: string;
  role_title: string;
  role_status: string;
  client_name: string;
  client_code: string;
  team_name: string;
  status: string;
  submission_date: string;
  is_discarded: number;
  discarded_at: string;
  discarded_reason: string;
  recruiter_name: string;
  recruiter_code: string;
}

export default function RecruiterCandidates() {
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [candidateDetails, setCandidateDetails] = useState<{ candidate: Candidate; associations: Association[] } | null>(null);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);

  useEffect(() => {
    fetchCandidates();
  }, [activeTab, searchQuery]);

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      const isActive = activeTab === 'active' ? '1' : '0';
      const searchParam = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : '';
      const response = await fetchWithAuth(`/api/recruiter/candidates?is_active=${isActive}${searchParam}`);
      
      if (response.ok) {
        const data = await response.json();
        setCandidates(data);
      }
    } catch (error) {
      console.error('Failed to fetch candidates:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCandidateDetails = async (candidateId: number) => {
    try {
      const response = await fetchWithAuth(`/api/recruiter/candidates/${candidateId}`);
      if (response.ok) {
        const data = await response.json();
        setCandidateDetails(data);
      }
    } catch (error) {
      console.error('Failed to fetch candidate details:', error);
    }
  };

  const handleViewDetails = async (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    await fetchCandidateDetails(candidate.id);
  };

  const handleDiscardCandidate = async (candidateId: number) => {
    if (!confirm('Are you sure you want to discard this candidate? They will be moved to the inactive list.')) {
      return;
    }

    try {
      const response = await fetchWithAuth(`/api/recruiter/candidates/${candidateId}/discard`, {
        method: 'POST'
      });

      if (response.ok) {
        setSelectedCandidate(null);
        setCandidateDetails(null);
        fetchCandidates();
      }
    } catch (error) {
      console.error('Failed to discard candidate:', error);
    }
  };

  const handleRestoreCandidate = async (candidateId: number) => {
    try {
      const response = await fetchWithAuth(`/api/recruiter/candidates/${candidateId}/restore`, {
        method: 'POST'
      });

      if (response.ok) {
        setSelectedCandidate(null);
        setCandidateDetails(null);
        fetchCandidates();
      }
    } catch (error) {
      console.error('Failed to restore candidate:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Candidates</h2>
          <p className="text-slate-500 mt-1">Manage your candidate database</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-6 py-2 rounded-md font-medium transition-all ${
            activeTab === 'active'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4" />
            Active Candidates
          </div>
        </button>
        <button
          onClick={() => setActiveTab('inactive')}
          className={`px-6 py-2 rounded-md font-medium transition-all ${
            activeTab === 'inactive'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <UserX className="w-4 h-4" />
            Inactive Candidates
          </div>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidates by name..."
            className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Candidates List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : candidates.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">
              {searchQuery
                ? `No candidates found for "${searchQuery}"`
                : `No ${activeTab} candidates yet`}
            </p>
            <p className="text-sm text-slate-500 mt-2">
              {searchQuery
                ? 'Try a different search term'
                : activeTab === 'active'
                ? 'Candidates will appear here when you add them via submissions'
                : 'Discarded candidates will appear here'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {candidates.map((candidate) => (
              <div
                key={candidate.id}
                className="p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-bold">
                        {candidate.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-800">{candidate.name}</h3>
                        <p className="text-sm text-slate-500 font-mono">{candidate.candidate_code}</p>
                      </div>
                    </div>
                    <div className="ml-13 space-y-1 text-sm text-slate-600">
                      {candidate.email && (
                        <p className="flex items-center gap-2">
                          <span className="text-slate-400">Email:</span>
                          {candidate.email}
                        </p>
                      )}
                      {candidate.phone && (
                        <p className="flex items-center gap-2">
                          <span className="text-slate-400">Phone:</span>
                          {candidate.phone}
                        </p>
                      )}
                      <div className="flex gap-4 mt-2">
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                          {candidate.total_associations} total submissions
                        </span>
                        <span className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs font-medium">
                          {candidate.active_associations} active
                        </span>
                        {candidate.discarded_associations > 0 && (
                          <span className="px-2 py-1 bg-red-50 text-red-700 rounded text-xs font-medium">
                            {candidate.discarded_associations} discarded
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleViewDetails(candidate)}
                      className="px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-2 font-medium"
                    >
                      <Eye className="w-4 h-4" />
                      View Details
                    </button>
                    {activeTab === 'active' ? (
                      <button
                        onClick={() => handleDiscardCandidate(candidate.id)}
                        className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2 font-medium"
                      >
                        <Trash2 className="w-4 h-4" />
                        Discard
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRestoreCandidate(candidate.id)}
                        className="px-4 py-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors flex items-center gap-2 font-medium"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Restore
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Candidate Details Modal */}
      {selectedCandidate && candidateDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5 flex justify-between items-center rounded-t-2xl">
              <div>
                <h3 className="text-2xl font-bold text-white">{candidateDetails.candidate.name}</h3>
                <p className="text-sm text-indigo-100 mt-1 font-mono">{candidateDetails.candidate.candidate_code}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingCandidate(candidateDetails.candidate)}
                  className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors flex items-center gap-2"
                  title="Edit candidate"
                >
                  <Edit className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    setSelectedCandidate(null);
                    setCandidateDetails(null);
                  }}
                  className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Contact Information */}
              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="font-semibold text-slate-800 mb-3">Contact Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-slate-500">Email:</span>
                    <p className="font-medium text-slate-800">{candidateDetails.candidate.email || 'Not provided'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Phone:</span>
                    <p className="font-medium text-slate-800">{candidateDetails.candidate.phone || 'Not provided'}</p>
                  </div>
                </div>
                {candidateDetails.candidate.notes && (
                  <div className="mt-3">
                    <span className="text-slate-500">Notes:</span>
                    <p className="text-slate-800 mt-1">{candidateDetails.candidate.notes}</p>
                  </div>
                )}
              </div>

              {/* Role Associations */}
              <div>
                <h4 className="font-semibold text-slate-800 mb-3">Role Submissions History</h4>
                {candidateDetails.associations.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-lg">
                    <Briefcase className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <p className="text-slate-600">No role submissions yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {candidateDetails.associations.map((assoc) => (
                      <div
                        key={assoc.id}
                        className={`border-2 rounded-lg p-4 ${
                          assoc.is_discarded
                            ? 'border-red-200 bg-red-50'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Briefcase className={`w-4 h-4 ${assoc.is_discarded ? 'text-red-600' : 'text-indigo-600'}`} />
                              <h5 className="font-semibold text-slate-800">{assoc.role_title}</h5>
                            </div>
                            <p className="text-sm text-slate-600 font-mono mb-2">{assoc.role_code}</p>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-slate-500">Client:</span>
                                <p className="font-medium text-slate-800">{assoc.client_name}</p>
                              </div>
                              <div>
                                <span className="text-slate-500">Team:</span>
                                <p className="font-medium text-slate-800">{assoc.team_name}</p>
                              </div>
                              <div>
                                <span className="text-slate-500">Role Status:</span>
                                <p className="font-medium text-slate-800 capitalize">{assoc.role_status}</p>
                              </div>
                              <div>
                                <span className="text-slate-500">Submitted:</span>
                                <p className="font-medium text-slate-800">
                                  {new Date(assoc.submission_date).toLocaleDateString()}
                                </p>
                              </div>
                              <div>
                                <span className="text-slate-500">Submitted by:</span>
                                <p className="font-medium text-slate-800">
                                  {assoc.recruiter_name} ({assoc.recruiter_code})
                                </p>
                              </div>
                              <div>
                                <span className="text-slate-500">Association Status:</span>
                                <p className="font-medium text-slate-800 capitalize">{assoc.status}</p>
                              </div>
                            </div>
                            {assoc.is_discarded && (
                              <div className="mt-3 pt-3 border-t border-red-200">
                                <p className="text-sm text-red-700">
                                  <strong>Discarded:</strong> {new Date(assoc.discarded_at).toLocaleDateString()}
                                </p>
                                {assoc.discarded_reason && (
                                  <p className="text-sm text-red-600 mt-1">
                                    Reason: {assoc.discarded_reason}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                          {assoc.is_discarded && (
                            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                              Discarded
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Candidate Modal */}
      {editingCandidate && (
        <EditCandidateModal
          candidate={editingCandidate}
          onClose={() => setEditingCandidate(null)}
          onSuccess={() => {
            setEditingCandidate(null);
            fetchCandidates();
            if (selectedCandidate) {
              fetchCandidateDetails(selectedCandidate.id);
            }
          }}
        />
      )}
    </div>
  );
}
