import { useState, useEffect } from "react";
import { X, Briefcase, Calendar, FileText, CheckCircle, Users, ArrowRight, Check, Plus, Send } from "lucide-react";
import { fetchWithAuth } from "@/react-app/utils/api";

interface Role {
  id: number;
  role_code: string;
  title: string;
  description: string;
  account_manager_name: string;
  client_id: number;
  team_id: number;
  status?: string;
}

interface Client {
  id: number;
  name: string;
  client_code: string;
  team_id: number;
  team_name: string;
  team_code: string;
}

interface AddSubmissionModalProps {
  client?: Client;
  selectedDate?: string;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = "role" | "entry";
type EntryType = "submission" | "interview" | null;

export default function AddSubmissionModal({ client, selectedDate, onClose, onSuccess }: AddSubmissionModalProps) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("role");
  
  // Role selection
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  
  // Entry type selection
  const [entryType, setEntryType] = useState<EntryType>(null);
  
  // Common fields
  const [submissionDate, setSubmissionDate] = useState(selectedDate || new Date().toISOString().split("T")[0]);
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [candidatePhone, setCandidatePhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  
  // Similar candidate detection
  const [similarCandidates, setSimilarCandidates] = useState<any[]>([]);
  const [showSimilarCandidates, setShowSimilarCandidates] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);
  
  // Submission-specific fields
  const [submissionType, setSubmissionType] = useState<"6h" | "24h" | "after_24h">("6h");
  const [cvMatchPercent, setCvMatchPercent] = useState<number>(90);
  
  // Interview-specific fields
  const [interviewLevel, setInterviewLevel] = useState<1 | 2 | 3>(1);

  // Update submission date when selectedDate prop changes
  useEffect(() => {
    if (selectedDate) {
      setSubmissionDate(selectedDate);
    }
  }, [selectedDate]);

  // Search for similar candidates when name is typed
  useEffect(() => {
    const searchSimilarCandidates = async () => {
      if (candidateName.trim().length >= 3) {
        try {
          const response = await fetchWithAuth(`/api/recruiter/candidates/search-similar?name=${encodeURIComponent(candidateName.trim())}`);
          if (response.ok) {
            const data = await response.json();
            if (data.length > 0) {
              setSimilarCandidates(data);
              setShowSimilarCandidates(true);
            } else {
              setSimilarCandidates([]);
              setShowSimilarCandidates(false);
            }
          }
        } catch (error) {
          console.error('Error searching similar candidates:', error);
        }
      } else {
        setSimilarCandidates([]);
        setShowSimilarCandidates(false);
      }
    };

    const debounceTimer = setTimeout(searchSimilarCandidates, 300);
    return () => clearTimeout(debounceTimer);
  }, [candidateName]);

  useEffect(() => {
    if (client) {
      fetchRoles();
    }
  }, [client]);

  const fetchRoles = async () => {
    if (!client) return;
    
    try {
      const response = await fetchWithAuth(`/api/recruiter/roles/${client.id}/${client.team_id}`);
      if (response.ok) {
        const data = await response.json();
        setRoles(data);
      }
    } catch (error) {
      console.error("Failed to fetch roles:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSelect = (role: Role) => {
    setSelectedRole(role);
    setStep("entry");
  };

  const resetForm = () => {
    setSelectedRole(null);
    setEntryType(null);
    setSubmissionType("6h");
    setInterviewLevel(1);
    setCandidateName("");
    setCandidateEmail("");
    setCandidatePhone("");
    setNotes("");
    setStep("role");
  };

  const submitEntry = async () => {
    if (!selectedRole || !client || !entryType) return false;

    try {
      const baseData: any = {
        client_id: client.id,
        team_id: client.team_id,
        role_id: selectedRole.id,
        submission_date: submissionDate,
        notes,
      };
      
      // Only add candidate fields if they have values
      if (candidateName.trim()) {
        baseData.candidate_name = candidateName.trim();
      }
      if (candidateEmail.trim()) {
        baseData.candidate_email = candidateEmail.trim();
      }
      if (candidatePhone.trim()) {
        baseData.candidate_phone = candidatePhone.trim();
      }
      if (selectedCandidateId) {
        baseData.candidate_id = selectedCandidateId;
      }

      if (entryType === "submission") {
        if (typeof cvMatchPercent !== 'number' || isNaN(cvMatchPercent)) {
          setSubmissionError('Please enter a valid CV Matching Percentage');
          return false;
        }
        if (cvMatchPercent < 85) {
          setSubmissionError('Submission blocked: CV Matching Percentage must be at least 85%');
          return false;
        }
        await fetchWithAuth("/api/recruiter/submissions", {
          method: "POST",
          body: JSON.stringify({
            ...baseData,
            entry_type: "submission",
            submission_type: submissionType,
            cv_match_percent: cvMatchPercent,
          }),
        });
      } else if (entryType === "interview") {
        await fetchWithAuth("/api/recruiter/submissions", {
          method: "POST",
          body: JSON.stringify({
            ...baseData,
            entry_type: "interview",
            interview_level: interviewLevel,
          }),
        });
      }

      return true;
    } catch (error) {
      console.error("Failed to create entry:", error);
      return false;
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmissionError(null);
    const success = await submitEntry();
    setSubmitting(false);
    
    if (success) {
      onSuccess();
      onClose();
    }
  };

  const handleSubmitAndAddAnother = async () => {
    setSubmitting(true);
    const success = await submitEntry();
    setSubmitting(false);
    
    if (success) {
      onSuccess();
      resetForm();
      // Refresh roles list
      await fetchRoles();
    }
  };

  if (!client && !selectedDate) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5 flex justify-between items-center rounded-t-2xl">
          <div>
            <h3 className="text-2xl font-bold text-white">Add Entry</h3>
            {client && (
              <p className="text-sm text-indigo-100 mt-1">
                {client.name} • {client.team_name}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-center gap-4">
            <div className={`flex items-center gap-2 ${step === "role" ? "text-indigo-600" : "text-slate-400"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                step === "role" ? "bg-indigo-600 text-white" : 
                step === "entry" ? "bg-emerald-500 text-white" : 
                "bg-slate-200 text-slate-600"
              }`}>
                {step === "entry" ? <Check className="w-5 h-5" /> : "1"}
              </div>
              <span className="font-semibold">Select Role</span>
            </div>
            <ArrowRight className="w-5 h-5 text-slate-400" />
            <div className={`flex items-center gap-2 ${step === "entry" ? "text-indigo-600" : "text-slate-400"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                step === "entry" ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"
              }`}>
                2
              </div>
              <span className="font-semibold">Add Entry</span>
            </div>
          </div>
        </div>

        {loading && client ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <div className="p-6">
            {/* Step 1: Role Selection */}
            {step === "role" && (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Step 1:</strong> Select the role you want to add an entry for
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Entry Date *
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="date"
                      value={submissionDate}
                      onChange={(e) => setSubmissionDate(e.target.value)}
                      max={new Date().toISOString().split("T")[0]}
                      className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      required
                      readOnly={!!selectedDate}
                    />
                  </div>
                  {selectedDate && (
                    <p className="text-xs text-slate-500 mt-1">
                      Date selected from calendar
                    </p>
                  )}
                </div>

                {client && roles.length > 0 ? (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Select Role *
                      <span className="text-xs text-slate-500 ml-2">
                        ({roles.length} active {roles.length === 1 ? 'role' : 'roles'} available)
                      </span>
                    </label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                      <select
                        value={selectedRole?.id || ""}
                        onChange={(e) => {
                          const role = roles.find(r => r.id === parseInt(e.target.value));
                          if (role) {
                            setSelectedRole(role);
                          }
                        }}
                        className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none bg-white cursor-pointer"
                      >
                        <option value="">-- Select a role --</option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.role_code} - {role.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Role Details Preview */}
                    {selectedRole && (
                      <div className="mt-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                        <div className="flex items-start gap-3">
                          <div className="bg-indigo-100 p-2 rounded-lg">
                            <Briefcase className="w-5 h-5 text-indigo-600" />
                          </div>
                          <div className="flex-1">
                            <h5 className="font-semibold text-slate-900 mb-1">
                              {selectedRole.title}
                            </h5>
                            <p className="text-xs text-slate-500 font-mono mb-2">{selectedRole.role_code}</p>
                            {selectedRole.description && (
                              <p className="text-sm text-slate-700 mb-2">{selectedRole.description}</p>
                            )}
                            <p className="text-xs text-slate-600">
                              Account Manager: <span className="font-medium">{selectedRole.account_manager_name}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Briefcase className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-600 font-medium">No active roles available</p>
                    <p className="text-sm text-slate-500 mt-2">
                      No active roles found for {client?.name} in {client?.team_name}
                    </p>
                  </div>
                )}

                {client && roles.length > 0 && (
                  <div className="flex justify-end pt-4">
                    <button
                      type="button"
                      onClick={() => selectedRole && handleRoleSelect(selectedRole)}
                      disabled={!selectedRole}
                      className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center gap-2"
                    >
                      Continue
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Add Entry */}
            {step === "entry" && selectedRole && (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Step 2:</strong> Add an entry for <strong>{selectedRole.title}</strong>
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Briefcase className="w-5 h-5 text-indigo-600" />
                    <h4 className="font-semibold text-slate-800">{selectedRole.title}</h4>
                  </div>
                  <p className="text-sm text-slate-500 font-mono">{selectedRole.role_code}</p>
                </div>

                {/* Entry Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    Entry Type *
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setEntryType("submission")}
                      className={`p-6 rounded-xl border-2 transition-all ${
                        entryType === "submission"
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`p-3 rounded-lg ${
                          entryType === "submission" ? "bg-blue-100" : "bg-slate-100"
                        }`}>
                          <Send className={`w-6 h-6 ${
                            entryType === "submission" ? "text-blue-600" : "text-slate-400"
                          }`} />
                        </div>
                        <div className="text-left">
                          <div className={`font-bold text-lg ${
                            entryType === "submission" ? "text-blue-800" : "text-slate-700"
                          }`}>
                            Submission
                          </div>
                          <div className={`text-sm ${
                            entryType === "submission" ? "text-blue-600" : "text-slate-500"
                          }`}>
                            Submit candidate profile
                          </div>
                        </div>
                      </div>
                      {entryType === "submission" && (
                        <div className="flex justify-center">
                          <CheckCircle className="w-6 h-6 text-blue-600" />
                        </div>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setEntryType("interview")}
                      className={`p-6 rounded-xl border-2 transition-all ${
                        entryType === "interview"
                          ? "border-purple-500 bg-purple-50"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`p-3 rounded-lg ${
                          entryType === "interview" ? "bg-purple-100" : "bg-slate-100"
                        }`}>
                          <Users className={`w-6 h-6 ${
                            entryType === "interview" ? "text-purple-600" : "text-slate-400"
                          }`} />
                        </div>
                        <div className="text-left">
                          <div className={`font-bold text-lg ${
                            entryType === "interview" ? "text-purple-800" : "text-slate-700"
                          }`}>
                            Interview
                          </div>
                          <div className={`text-sm ${
                            entryType === "interview" ? "text-purple-600" : "text-slate-500"
                          }`}>
                            Schedule interview round
                          </div>
                        </div>
                      </div>
                      {entryType === "interview" && (
                        <div className="flex justify-center">
                          <CheckCircle className="w-6 h-6 text-purple-600" />
                        </div>
                      )}
                    </button>
                  </div>
                </div>

                {/* Submission-specific fields */}
                {entryType === "submission" && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                      Response Time *
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        { value: "6h", label: "Within 6 Hours", desc: "Fast response", color: "emerald" },
                        { value: "24h", label: "Within 24 Hours", desc: "Same day", color: "blue" },
                        { value: "after_24h", label: "After 24 Hours", desc: "Standard", color: "purple" },
                      ].map((type) => (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setSubmissionType(type.value as any)}
                          className={`p-4 rounded-xl border-2 transition-all ${
                            submissionType === type.value
                              ? `border-${type.color}-500 bg-${type.color}-50`
                              : "border-slate-200 hover:border-slate-300 bg-white"
                          }`}
                        >
                          <div className={`text-sm font-semibold mb-1 ${
                            submissionType === type.value ? `text-${type.color}-800` : "text-slate-900"
                          }`}>
                            {type.label}
                          </div>
                          <div className={`text-xs ${
                            submissionType === type.value ? `text-${type.color}-600` : "text-slate-500"
                          }`}>
                            {type.desc}
                          </div>
                          {submissionType === type.value && (
                            <div className="flex justify-center mt-2">
                              <CheckCircle className={`w-5 h-5 text-${type.color}-600`} />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        CV Matching Percentage *
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={cvMatchPercent}
                        onChange={(e) => setCvMatchPercent(parseFloat(e.target.value))}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="Enter percentage (0-100)"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Minimum allowed is 85%
                      </p>
                    </div>
                  </div>
                )}

                {/* Interview-specific fields */}
                {entryType === "interview" && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                      Interview Level *
                    </label>
                    <div className="grid grid-cols-3 gap-4">
                      {[1, 2, 3].map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setInterviewLevel(level as 1 | 2 | 3)}
                          className={`p-6 rounded-xl border-2 transition-all ${
                            interviewLevel === level
                              ? "border-purple-500 bg-purple-50"
                              : "border-slate-200 hover:border-slate-300 bg-white"
                          }`}
                        >
                          <div className={`text-3xl font-bold mb-2 ${
                            interviewLevel === level ? "text-purple-600" : "text-slate-400"
                          }`}>
                            {level}
                          </div>
                          <div className={`text-sm ${
                            interviewLevel === level ? "text-purple-700" : "text-slate-500"
                          }`}>
                            Level {level}
                          </div>
                          {interviewLevel === level && (
                            <div className="flex justify-center mt-2">
                              <CheckCircle className="w-5 h-5 text-purple-600" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Common fields - only show if entry type is selected */}
                {entryType && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Candidate Name (Optional)
                      </label>
                      <input
                        type="text"
                        value={candidateName}
                        onChange={(e) => {
                          setCandidateName(e.target.value);
                          setSelectedCandidateId(null);
                        }}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="Enter candidate's name..."
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        For role: <span className="font-semibold">{selectedRole.title}</span>
                      </p>
                      
                      {/* Similar Candidates Alert */}
                      {showSimilarCandidates && similarCandidates.length > 0 && (
                        <div className="mt-3 p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="bg-yellow-100 p-2 rounded-lg">
                              <Users className="w-5 h-5 text-yellow-700" />
                            </div>
                            <div className="flex-1">
                              <h5 className="font-semibold text-yellow-900 mb-1">
                                Similar Candidates Found
                              </h5>
                              <p className="text-sm text-yellow-700">
                                We found {similarCandidates.length} candidate{similarCandidates.length > 1 ? 's' : ''} with similar names. 
                                Are you submitting one of these existing candidates?
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowSimilarCandidates(false)}
                              className="text-yellow-600 hover:text-yellow-800"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                          
                          <div className="space-y-2">
                            {similarCandidates.map((candidate) => (
                              <button
                                key={candidate.id}
                                type="button"
                                onClick={() => {
                                  setSelectedCandidateId(candidate.id);
                                  setCandidateName(candidate.name);
                                  setCandidateEmail(candidate.email || "");
                                  setCandidatePhone(candidate.phone || "");
                                  setShowSimilarCandidates(false);
                                }}
                                className={`w-full p-3 rounded-lg text-left transition-all ${
                                  selectedCandidateId === candidate.id
                                    ? 'bg-indigo-100 border-2 border-indigo-400'
                                    : 'bg-white border border-yellow-200 hover:border-yellow-400'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-slate-900">{candidate.name}</span>
                                      <span className="text-xs text-slate-500 font-mono">{candidate.candidate_code}</span>
                                      {selectedCandidateId === candidate.id && (
                                        <CheckCircle className="w-4 h-4 text-indigo-600" />
                                      )}
                                    </div>
                                    {candidate.email && (
                                      <p className="text-xs text-slate-600 mt-1">{candidate.email}</p>
                                    )}
                                    <div className="flex gap-2 mt-2">
                                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                        {candidate.total_associations || 0} submissions
                                      </span>
                                      {candidate.is_active === 0 && (
                                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                                          Inactive
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            ))}
                            
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCandidateId(null);
                                setShowSimilarCandidates(false);
                              }}
                              className="w-full p-3 bg-white border-2 border-emerald-300 rounded-lg text-emerald-700 font-medium hover:bg-emerald-50 transition-colors"
                            >
                              <div className="flex items-center justify-center gap-2">
                                <Plus className="w-4 h-4" />
                                This is a new candidate
                              </div>
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {selectedCandidateId && (
                        <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded text-sm text-emerald-700 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          Using existing candidate record
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Email (Optional)
                        </label>
                        <input
                          type="email"
                          value={candidateEmail}
                          onChange={(e) => setCandidateEmail(e.target.value)}
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          placeholder="candidate@example.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Phone (Optional)
                        </label>
                        <input
                          type="tel"
                          value={candidatePhone}
                          onChange={(e) => setCandidatePhone(e.target.value)}
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          placeholder="+1 234 567 8900"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Notes (Optional)
                      </label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={3}
                          className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                          placeholder="Add any additional details..."
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="flex gap-3 pt-4">
                  {submissionError && (
                    <div className="flex-1 px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                      {submissionError}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setStep("role");
                      setSelectedRole(null);
                      setEntryType(null);
                    }}
                    className="px-6 py-3 border-2 border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitAndAddAnother}
                    disabled={submitting || !entryType}
                    className="flex-1 px-6 py-3 border-2 border-indigo-600 text-indigo-600 rounded-lg font-medium hover:bg-indigo-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    {submitting ? "Submitting..." : "Add Another Entry"}
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting || !entryType}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    {submitting ? "Submitting..." : "Submit & Close"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
