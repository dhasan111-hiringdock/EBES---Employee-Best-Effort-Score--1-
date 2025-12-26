import { X, Calendar as CalendarIcon, Briefcase, Clock, TrendingUp, Users, UserX, FileText, Building2 } from "lucide-react";

interface Submission {
  id: number;
  entry_type: string;
  submission_type?: string;
  submission_date: string;
  role_title: string;
  role_code: string;
  client_name: string;
  team_name: string;
  account_manager_name: string;
  interview_level?: number;
  dropout_reason?: string;
  candidate_name?: string;
  notes?: string;
  created_at: string;
}

interface DayDetailsModalProps {
  date: string;
  submissions: Submission[];
  onClose: () => void;
  onAddEntry: () => void;
}

export default function DayDetailsModal({ date, submissions, onClose, onAddEntry }: DayDetailsModalProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getEntryTypeColor = (entryType: string) => {
    switch (entryType) {
      case 'submission': return 'bg-blue-50 border-blue-200 text-blue-700';
      case 'interview': return 'bg-purple-50 border-purple-200 text-purple-700';
      case 'deal': return 'bg-emerald-50 border-emerald-200 text-emerald-700';
      case 'dropout': return 'bg-red-50 border-red-200 text-red-700';
      default: return 'bg-slate-50 border-slate-200 text-slate-700';
    }
  };

  const getEntryTypeIcon = (entryType: string) => {
    switch (entryType) {
      case 'submission': return <FileText className="w-5 h-5" />;
      case 'interview': return <Users className="w-5 h-5" />;
      case 'deal': return <TrendingUp className="w-5 h-5" />;
      case 'dropout': return <UserX className="w-5 h-5" />;
      default: return <FileText className="w-5 h-5" />;
    }
  };

  const getSubmissionTypeLabel = (type?: string) => {
    switch (type) {
      case '6h': return 'Fast response (within 6h)';
      case '24h': return 'Same day (within 24h)';
      case 'after_24h': return 'Standard (after 24h)';
      default: return '';
    }
  };

  const getInterviewLevelLabel = (level?: number) => {
    switch (level) {
      case 1: return '1st Interview';
      case 2: return '2nd Interview';
      case 3: return '3rd Interview';
      default: return 'Interview';
    }
  };

  const submissions_only = submissions.filter(s => s.entry_type === 'submission');
  const interviews = submissions.filter(s => s.entry_type === 'interview');
  const deals = submissions.filter(s => s.entry_type === 'deal');
  const dropouts = submissions.filter(s => s.entry_type === 'dropout');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5 flex justify-between items-center rounded-t-2xl z-10">
          <div>
            <h3 className="text-2xl font-bold text-white">Day Details</h3>
            <div className="flex items-center gap-2 mt-1">
              <CalendarIcon className="w-4 h-4 text-indigo-100" />
              <p className="text-sm text-indigo-100">{formatDate(date)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-600">Submissions</span>
              </div>
              <p className="text-2xl font-bold text-blue-700">{submissions_only.length}</p>
            </div>
            <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-5 h-5 text-purple-600" />
                <span className="text-sm font-medium text-purple-600">Interviews</span>
              </div>
              <p className="text-2xl font-bold text-purple-700">{interviews.length}</p>
            </div>
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-600">Deals</span>
              </div>
              <p className="text-2xl font-bold text-emerald-700">{deals.length}</p>
            </div>
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <UserX className="w-5 h-5 text-red-600" />
                <span className="text-sm font-medium text-red-600">Dropouts</span>
              </div>
              <p className="text-2xl font-bold text-red-700">{dropouts.length}</p>
            </div>
          </div>

          {submissions.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 border border-slate-200 rounded-xl">
              <CalendarIcon className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 font-medium mb-2">No entries for this day</p>
              <p className="text-sm text-slate-500 mb-6">Add your first submission, interview, deal, or dropout</p>
              <button
                onClick={onAddEntry}
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg"
              >
                Add Entry
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {submissions.map((submission) => (
                <div 
                  key={submission.id}
                  className={`border-2 rounded-xl p-4 ${getEntryTypeColor(submission.entry_type)}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`p-3 rounded-lg ${submission.entry_type === 'submission' ? 'bg-blue-100' : submission.entry_type === 'interview' ? 'bg-purple-100' : submission.entry_type === 'deal' ? 'bg-emerald-100' : 'bg-red-100'}`}>
                      {getEntryTypeIcon(submission.entry_type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Header Row */}
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-slate-900 capitalize">
                              {submission.entry_type === 'interview' 
                                ? getInterviewLevelLabel(submission.interview_level)
                                : submission.entry_type}
                            </span>
                            {submission.entry_type === 'submission' && submission.submission_type && (
                              <span className="text-xs px-2 py-1 rounded-full bg-white bg-opacity-60 font-medium">
                                {getSubmissionTypeLabel(submission.submission_type)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Clock className="w-4 h-4" />
                            <span>Added at {formatTime(submission.created_at)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Candidate Name */}
                      {submission.candidate_name && (
                        <div className="p-2.5 bg-white bg-opacity-70 rounded-lg border border-slate-200 mb-2">
                          <p className="text-sm font-semibold text-indigo-900">
                            Candidate: {submission.candidate_name}
                          </p>
                        </div>
                      )}

                      {/* Role Information */}
                      <div className="space-y-2 mt-3">
                        <div className="flex items-start gap-2">
                          <Briefcase className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-900">{submission.role_title}</p>
                            <p className="text-xs font-mono text-slate-500">{submission.role_code}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm">
                          <Building2 className="w-4 h-4 text-slate-500" />
                          <span className="text-slate-700">
                            {submission.client_name} • {submission.team_name}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          <Users className="w-4 h-4 text-slate-500" />
                          <span className="text-slate-700">
                            AM: {submission.account_manager_name}
                          </span>
                        </div>
                      </div>

                      {/* Dropout Reason */}
                      {submission.entry_type === 'dropout' && submission.dropout_reason && (
                        <div className="mt-3 p-3 bg-red-100 border border-red-200 rounded-lg">
                          <p className="text-sm font-medium text-red-900 mb-1">Dropout Reason:</p>
                          <p className="text-sm text-red-800">{submission.dropout_reason}</p>
                        </div>
                      )}

                      {/* Notes */}
                      {submission.notes && (
                        <div className="mt-3 p-3 bg-white bg-opacity-60 rounded-lg border border-slate-200">
                          <p className="text-sm font-medium text-slate-700 mb-1">Notes:</p>
                          <p className="text-sm text-slate-600">{submission.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6 pt-6 border-t border-slate-200">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors"
            >
              Close
            </button>
            <button
              onClick={onAddEntry}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg"
            >
              Add Entry for This Day
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
