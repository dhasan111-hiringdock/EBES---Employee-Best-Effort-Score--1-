import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, FileText } from 'lucide-react';
import { fetchWithAuth } from '@/react-app/utils/api';

interface DropoutRequest {
  id: number;
  role_id: number;
  role_code: string;
  role_title: string;
  client_name: string;
  recruiter_name: string;
  recruiter_code: string;
  rm_name: string;
  dropout_reason: string;
  rm_notes: string;
  created_at: string;
  rm_acknowledged_at: string;
}

export default function DropoutDecisions() {
  const [requests, setRequests] = useState<DropoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<DropoutRequest | null>(null);
  const [decision, setDecision] = useState<'accept' | 'ignore' | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await fetchWithAuth('/api/am/dropout-requests');
      if (response.ok) {
        const data = await response.json();
        setRequests(data);
      }
    } catch (error) {
      console.error('Failed to fetch dropout requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDecide = async () => {
    if (!selectedRequest || !decision) return;
    if (decision === 'accept' && !newStatus) {
      alert('Please select a role status for accepted dropouts');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetchWithAuth(`/api/am/dropout-requests/${selectedRequest.id}/decide`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          new_role_status: newStatus || null
        })
      });

      if (response.ok) {
        setRequests(prev => prev.filter(r => r.id !== selectedRequest.id));
        setSelectedRequest(null);
        setDecision(null);
        setNewStatus('');
      } else {
        alert('Failed to process decision');
      }
    } catch (error) {
      console.error('Failed to decide:', error);
      alert('Failed to process decision');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-200 border-t-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Dropout Decisions</h2>
        <div className="flex items-center gap-2 px-4 py-2 bg-red-100 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <span className="text-sm font-medium text-red-800">
            {requests.length} Awaiting Decision
          </span>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-800 mb-2">No Pending Decisions</h3>
          <p className="text-slate-600">All dropout requests have been processed.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                      Dropout - Decision Required
                    </span>
                    <span className="text-sm text-slate-500">
                      RM Acknowledged: {new Date(request.rm_acknowledged_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <h3 className="text-lg font-semibold text-slate-800 mb-1">
                    {request.role_title}
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                    <div>
                      <span className="text-slate-500">Role Code:</span>
                      <span className="ml-2 font-medium text-slate-800">{request.role_code}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Client:</span>
                      <span className="ml-2 font-medium text-slate-800">{request.client_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Recruiter:</span>
                      <span className="ml-2 font-medium text-slate-800">
                        {request.recruiter_name} ({request.recruiter_code})
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">RM:</span>
                      <span className="ml-2 font-medium text-slate-800">{request.rm_name || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <FileText className="w-4 h-4 text-orange-600 mt-0.5" />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-orange-800 block mb-1">
                            Recruiter's Reason:
                          </span>
                          <p className="text-sm text-orange-700">{request.dropout_reason}</p>
                        </div>
                      </div>
                    </div>

                    {request.rm_notes && (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <FileText className="w-4 h-4 text-blue-600 mt-0.5" />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-blue-800 block mb-1">
                              RM's Notes:
                            </span>
                            <p className="text-sm text-blue-700">{request.rm_notes}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedRequest(request)}
                className="w-full mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
              >
                Make Decision
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Decision Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-800">Dropout Decision</h3>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="font-semibold text-slate-800 mb-3">Request Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Role:</span>
                    <span className="font-medium text-slate-800">{selectedRequest.role_title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Code:</span>
                    <span className="font-medium text-slate-800">{selectedRequest.role_code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Recruiter:</span>
                    <span className="font-medium text-slate-800">
                      {selectedRequest.recruiter_name} ({selectedRequest.recruiter_code})
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <h4 className="font-semibold text-orange-800 mb-2">Recruiter's Reason:</h4>
                  <p className="text-sm text-orange-700">{selectedRequest.dropout_reason}</p>
                </div>

                {selectedRequest.rm_notes && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-2">RM's Notes:</h4>
                    <p className="text-sm text-blue-700">{selectedRequest.rm_notes}</p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-slate-800">Your Decision:</h4>
                
                <div className="grid gap-3">
                  <button
                    onClick={() => setDecision('accept')}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      decision === 'accept'
                        ? 'border-red-500 bg-red-50'
                        : 'border-slate-200 hover:border-red-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <XCircle className={`w-6 h-6 ${decision === 'accept' ? 'text-red-600' : 'text-slate-400'}`} />
                      <div className="flex-1">
                        <h5 className="font-semibold text-slate-800 mb-1">Accept Dropout</h5>
                        <p className="text-sm text-slate-600">
                          Recruiter is at fault. Apply <strong>-5 points</strong> penalty to their EBES score.
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setDecision('ignore')}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      decision === 'ignore'
                        ? 'border-green-500 bg-green-50'
                        : 'border-slate-200 hover:border-green-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <CheckCircle className={`w-6 h-6 ${decision === 'ignore' ? 'text-green-600' : 'text-slate-400'}`} />
                      <div className="flex-1">
                        <h5 className="font-semibold text-slate-800 mb-1">Ignore Dropout</h5>
                        <p className="text-sm text-slate-600">
                          Not recruiter's fault. <strong>No penalty</strong> applied. Can optionally update role status.
                        </p>
                      </div>
                    </div>
                  </button>
                </div>

                {decision && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {decision === 'accept' ? (
                        <>Update Role Status <span className="text-red-500">*</span></>
                      ) : (
                        <>Update Role Status (Optional)</>
                      )}
                    </label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">Choose status...</option>
                      <option value="dropout">Dropout</option>
                      <option value="lost">Lost</option>
                      <option value="on_hold">On Hold</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="no_answer">No Answer</option>
                    </select>
                    {decision === 'accept' && (
                      <p className="text-xs text-slate-500 mt-2">
                        <strong>Note:</strong> Selecting any status will apply -5 penalty to recruiter's EBES score.
                      </p>
                    )}
                    {decision === 'ignore' && (
                      <p className="text-xs text-slate-500 mt-2">
                        <strong>Note:</strong> Even if you set status to "Dropout", no penalty will be applied.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => {
                  setSelectedRequest(null);
                  setDecision(null);
                  setNewStatus('');
                }}
                disabled={submitting}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDecide}
                disabled={submitting || !decision}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Processing...
                  </>
                ) : (
                  'Confirm Decision'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
