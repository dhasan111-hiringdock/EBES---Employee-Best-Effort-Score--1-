import { useState, useEffect } from "react";
import { X, Briefcase, Calendar, TrendingUp, UserX, FileText } from "lucide-react";
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

interface QuickEntryModalProps {
  client?: Client;
  onClose: () => void;
  onSuccess: () => void;
}

type EntryType = "deal" | "dropout";

export default function QuickEntryModal({ client, onClose, onSuccess }: QuickEntryModalProps) {
  const [activeRoles, setActiveRoles] = useState<Role[]>([]);
  const [dealRoles, setDealRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [entryType, setEntryType] = useState<EntryType>("deal");
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const [dropoutReason, setDropoutReason] = useState("");
  
  // Dropdown role selection modal
  const [showDropoutModal, setShowDropoutModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, [client]);

  const fetchData = async () => {
    if (!client) return;
    
    try {
      // Fetch active roles for deals
      const rolesResponse = await fetchWithAuth(`/api/recruiter/roles/${client.id}/${client.team_id}`);
      if (rolesResponse.ok) {
        const rolesData = await rolesResponse.json();
        setActiveRoles(rolesData);
      }

      // Fetch deal roles for dropouts (filtered by selected client and team)
      const dealRolesResponse = await fetchWithAuth(`/api/recruiter/deal-roles?client_id=${client.id}&team_id=${client.team_id}`);
      if (dealRolesResponse.ok) {
        const dealRolesData = await dealRolesResponse.json();
        setDealRoles(dealRolesData);
      }
    } catch (error) {
      console.error("Failed to fetch roles:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedRole || !client) return;

    setSubmitting(true);
    try {
      if (entryType === "deal") {
        // Submit deal entry
        await fetchWithAuth("/api/recruiter/submissions", {
          method: "POST",
          body: JSON.stringify({
            client_id: client.id,
            team_id: client.team_id,
            role_id: selectedRole.id,
            entry_type: "deal",
            submission_date: entryDate,
            notes: "",
          }),
        });
      } else {
        // Submit dropout entry
        const roleDetails = dealRoles.find(r => r.id === selectedRole.id);
        if (roleDetails) {
          await fetchWithAuth("/api/recruiter/submissions", {
            method: "POST",
            body: JSON.stringify({
              entry_type: "dropout",
              dropout_role_id: selectedRole.id,
              dropout_reason: dropoutReason,
              client_id: roleDetails.client_id,
              team_id: roleDetails.team_id,
              role_id: roleDetails.id,
              submission_date: entryDate,
              notes: "",
            }),
          });
        }
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to create entry:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectDropoutRole = (role: Role) => {
    setSelectedRole(role);
    setShowDropoutModal(false);
  };

  const availableRoles = entryType === "deal" ? activeRoles : dealRoles;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5 flex justify-between items-center rounded-t-2xl">
            <div>
              <h3 className="text-2xl font-bold text-white">Quick Entry</h3>
              {client && (
                <p className="text-sm text-emerald-100 mt-1">
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

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  Quickly add a deal or dropout entry without a submission
                </p>
              </div>

              {/* Entry Type Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  Entry Type *
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setEntryType("deal");
                      setSelectedRole(null);
                      setDropoutReason("");
                    }}
                    className={`p-6 rounded-xl border-2 transition-all text-left ${
                      entryType === "deal"
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        entryType === "deal" ? "bg-emerald-100" : "bg-slate-100"
                      }`}>
                        <TrendingUp className={`w-5 h-5 ${
                          entryType === "deal" ? "text-emerald-600" : "text-slate-400"
                        }`} />
                      </div>
                      <span className={`font-semibold ${
                        entryType === "deal" ? "text-emerald-800" : "text-slate-700"
                      }`}>
                        Deal
                      </span>
                    </div>
                    <p className={`text-sm ${
                      entryType === "deal" ? "text-emerald-600" : "text-slate-500"
                    }`}>
                      Mark a role as closed deal
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEntryType("dropout");
                      setSelectedRole(null);
                      setDropoutReason("");
                    }}
                    className={`p-6 rounded-xl border-2 transition-all text-left ${
                      entryType === "dropout"
                        ? "border-red-500 bg-red-50"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        entryType === "dropout" ? "bg-red-100" : "bg-slate-100"
                      }`}>
                        <UserX className={`w-5 h-5 ${
                          entryType === "dropout" ? "text-red-600" : "text-slate-400"
                        }`} />
                      </div>
                      <span className={`font-semibold ${
                        entryType === "dropout" ? "text-red-800" : "text-slate-700"
                      }`}>
                        Dropout
                      </span>
                    </div>
                    <p className={`text-sm ${
                      entryType === "dropout" ? "text-red-600" : "text-slate-500"
                    }`}>
                      Record candidate dropout
                    </p>
                  </button>
                </div>
              </div>

              {/* Date Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Entry Date *
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              {/* Role Selection */}
              {entryType === "deal" ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Select Active Role *
                    <span className="text-xs text-slate-500 ml-2">
                      ({availableRoles.length} active {availableRoles.length === 1 ? 'role' : 'roles'} available)
                    </span>
                  </label>
                  {availableRoles.length > 0 ? (
                    <>
                      <div className="relative">
                        <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                        <select
                          value={selectedRole?.id || ""}
                          onChange={(e) => {
                            const role = availableRoles.find(r => r.id === parseInt(e.target.value));
                            setSelectedRole(role || null);
                          }}
                          className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent appearance-none bg-white cursor-pointer"
                        >
                          <option value="">-- Select a role --</option>
                          {availableRoles.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.role_code} - {role.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      {selectedRole && (
                        <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                          <div className="flex items-start gap-3">
                            <div className="bg-emerald-100 p-2 rounded-lg">
                              <Briefcase className="w-5 h-5 text-emerald-600" />
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
                    </>
                  ) : (
                    <div className="text-center py-8 bg-slate-50 border border-slate-200 rounded-lg">
                      <Briefcase className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                      <p className="text-slate-600 font-medium">No active roles available</p>
                      <p className="text-sm text-slate-500 mt-1">
                        No active roles found for this client
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Select Role with Deal *
                    <span className="text-xs text-slate-500 ml-2">
                      (Roles with deals for this client)
                    </span>
                  </label>
                  {availableRoles.length > 0 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowDropoutModal(true)}
                        className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                          selectedRole
                            ? "border-red-500 bg-red-50"
                            : "border-slate-300 hover:border-slate-400 bg-white"
                        }`}
                      >
                        {selectedRole ? (
                          <div className="flex items-start gap-3">
                            <div className="bg-red-100 p-2 rounded-lg">
                              <Briefcase className="w-5 h-5 text-red-600" />
                            </div>
                            <div className="flex-1">
                              <div className="font-semibold text-slate-900">{selectedRole.title}</div>
                              <div className="text-xs text-slate-500 font-mono mt-1">{selectedRole.role_code}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-slate-500 text-center">Click to select a role with deal</div>
                        )}
                      </button>
                      
                      {selectedRole && (
                        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                          <p className="text-sm text-amber-800">
                            <strong>Note:</strong> This indicates a consultant was offered the role but declined it. Only your Account Manager can modify this role afterward.
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8 bg-slate-50 border border-slate-200 rounded-lg">
                      <Briefcase className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                      <p className="text-slate-600 font-medium">No roles with deals found</p>
                      <p className="text-sm text-slate-500 mt-1">
                        No roles with deals found for this client
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Dropout Reason Field */}
              {entryType === "dropout" && selectedRole && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Dropout Reason *
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                    <textarea
                      value={dropoutReason}
                      onChange={(e) => setDropoutReason(e.target.value)}
                      rows={3}
                      className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                      placeholder="Why did the candidate decline this offer? (e.g., better offer, relocation issues, compensation, etc.)"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-6 py-3 border-2 border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || !selectedRole || (entryType === "dropout" && !dropoutReason.trim())}
                  className={`flex-1 px-6 py-3 ${
                    entryType === "deal"
                      ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                      : "bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700"
                  } text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg`}
                >
                  {submitting ? "Submitting..." : `Submit ${entryType === "deal" ? "Deal" : "Dropout"}`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dropout Role Selection Modal */}
      {showDropoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-red-600 to-orange-600 px-6 py-4 flex justify-between items-center rounded-t-2xl">
              <div className="flex items-center gap-2">
                <UserX className="w-6 h-6 text-white" />
                <h3 className="text-xl font-bold text-white">Select Role with Deal</h3>
              </div>
              <button
                onClick={() => setShowDropoutModal(false)}
                className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="space-y-2">
                {dealRoles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => handleSelectDropoutRole(role)}
                    className="w-full p-4 rounded-lg border-2 border-slate-200 hover:border-red-300 bg-white hover:bg-red-50 transition-all text-left"
                  >
                    <div className="flex items-start gap-3">
                      <div className="bg-red-100 p-2 rounded-lg">
                        <Briefcase className="w-5 h-5 text-red-600" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-slate-900">{role.title}</div>
                        <div className="text-xs text-slate-500 font-mono mt-1">{role.role_code}</div>
                        {role.description && (
                          <p className="text-sm text-slate-600 mt-2 line-clamp-2">{role.description}</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
