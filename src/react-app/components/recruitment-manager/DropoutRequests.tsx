import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, FileText } from 'lucide-react';
import { fetchWithAuth } from '@/react-app/utils/api';

interface DropoutRequest {
  id: number;
  role_id: number;
  role_code: string;
  role_title: string;
  client_name: string;
  recruiter_name: string;
  recruiter_code: string;
  am_name: string;
  dropout_reason: string;
  created_at: string;
}

export default function DropoutRequests() {
  const [requests, setRequests] = useState<DropoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<DropoutRequest | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await fetchWithAuth('/api/rm/dropout-requests');
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

  const handleAcknowledge = async () => {
    if (!selectedRequest) return;

    setSubmitting(true);
    try {
      const response = await fetchWithAuth(`/api/rm/dropout-requests/${selectedRequest.id}/acknowledge`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rm_notes: notes })
      });

      if (response.ok) {
        setRequests(prev => prev.filter(r => r.id !== selectedRequest.id));
        setSelectedRequest(null);
        setNotes('');
      } else {
        alert('Failed to acknowledge dropout request');
      }
    } catch (error) {
      console.error('Failed to acknowledge:', error);
      alert('Failed to acknowledge dropout request');
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
        <h2 className="text-2xl font-bold text-slate-800">Dropout Requests</h2>
        <div className="flex items-center gap-2 px-4 py-2 bg-orange-100 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-orange-600" />
          <span className="text-sm font-medium text-orange-800">
            {requests.length} Pending
          </span>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-800 mb-2">All Caught Up!</h3>
          <p className="text-slate-600">No pending dropout requests to review.</p>
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
                      Dropout
                    </span>
                    <span className="text-sm text-slate-500">
                      {new Date(request.created_at).toLocaleDateString()}
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
                      <span className="text-slate-500">Account Manager:</span>
                      <span className="ml-2 font-medium text-slate-800">{request.am_name}</span>
                    </div>
                  </div>

                  <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <FileText className="w-4 h-4 text-slate-500 mt-0.5" />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-slate-700 block mb-1">
                          Dropout Reason:
                        </span>
                        <p className="text-sm text-slate-600">{request.dropout_reason}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedRequest(request)}
                className="w-full mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
              >
                Review & Acknowledge
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Acknowledge Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-800">Acknowledge Dropout Request</h3>
            </div>

            <div className="p-6 space-y-4">
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
                  <div className="flex justify-between">
                    <span className="text-slate-600">Client:</span>
                    <span className="font-medium text-slate-800">{selectedRequest.client_name}</span>
                  </div>
                </div>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-orange-800 mb-1">Recruiter's Reason:</h4>
                    <p className="text-sm text-orange-700">{selectedRequest.dropout_reason}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Your Notes (for Account Manager)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add your observations or recommendations..."
                  rows={4}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                />
                <p className="text-xs text-slate-500 mt-1">
                  These notes will be shared with the Account Manager to help them make a decision.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  By acknowledging this request, you're forwarding it to the Account Manager ({selectedRequest.am_name}) 
                  for final decision. They will determine if the dropout penalty applies.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => {
                  setSelectedRequest(null);
                  setNotes('');
                }}
                disabled={submitting}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAcknowledge}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Acknowledging...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Acknowledge & Forward to AM
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
