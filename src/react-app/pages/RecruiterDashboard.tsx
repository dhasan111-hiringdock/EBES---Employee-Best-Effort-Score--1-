import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router";
import RecruiterLayout from "@/react-app/components/recruiter/RecruiterLayout";
import RecruiterAnalytics from "@/react-app/pages/RecruiterAnalytics";
import RecruiterCandidates from "@/react-app/pages/RecruiterCandidates";
import RecruiterRoles from "@/react-app/pages/RecruiterRoles";
import CompanyPage from "@/react-app/pages/CompanyPage";
import RecruiterProfile from "@/react-app/components/recruiter/RecruiterProfile";
import { Building2, Target, CalendarDays, Users, TrendingUp, Plus, Zap, Clock, Briefcase, Activity, Search, BarChart3, AlertTriangle } from "lucide-react";
import AddSubmissionModal from '@/react-app/components/recruiter/AddSubmissionModal';
import QuickEntryModal from '@/react-app/components/recruiter/QuickEntryModal';
import DayDetailsModal from '@/react-app/components/recruiter/DayDetailsModal';
import Calendar from '@/react-app/components/recruiter/Calendar';
import { fetchWithAuth } from "@/react-app/utils/api";

export default function RecruiterDashboard() {
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      console.log('Fetching clients...');
      const response = await fetchWithAuth('/api/recruiter/clients');
      console.log('Clients response:', response.status);
      
      if (response.ok) {
        const clientsData = await response.json();
        console.log('Clients data:', clientsData);
        setClients(clientsData);
      } else {
        console.error('Failed to fetch clients, status:', response.status);
        const errorText = await response.text();
        console.error('Error response:', errorText);
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show client selector if no client is selected
  if (!selectedClient) {
    // If no clients available, show error message
    if (clients.length === 0) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 max-w-md w-full text-center">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center">
                <Building2 className="w-8 h-8 text-red-600" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">
              No Clients Assigned
            </h2>
            <p className="text-slate-500 mb-4">
              You don't have any clients assigned to your account yet.
            </p>
            <p className="text-sm text-slate-400">
              Please contact your administrator to assign clients to your account.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 max-w-md w-full">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center">
              <Building2 className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 text-center mb-2">
            Select Client
          </h2>
          <p className="text-slate-500 text-center mb-6">
            Choose a client to view their dashboard
          </p>
          <div className="space-y-3">
            {clients.map((client) => (
              <button
                key={client.id}
                onClick={() => setSelectedClient(client)}
                className="w-full p-4 bg-gradient-to-r from-slate-50 to-slate-100 hover:from-indigo-50 hover:to-purple-50 border-2 border-slate-200 hover:border-indigo-300 rounded-xl transition-all text-left group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">
                      {client.name}
                    </p>
                    <p className="text-sm text-slate-500 font-mono">
                      {client.client_code}
                    </p>
                    {client.team_name && (
                      <p className="text-xs text-slate-400 mt-1">
                        Team: {client.team_name} ({client.team_code})
                      </p>
                    )}
                  </div>
                  <div className="w-8 h-8 bg-indigo-100 group-hover:bg-indigo-200 rounded-lg flex items-center justify-center transition-colors">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <RecruiterLayout selectedClient={selectedClient} onClientChange={setSelectedClient}>
      <Routes>
        <Route index element={<DashboardContent selectedClient={selectedClient} />} />
        <Route path="analytics" element={<RecruiterAnalytics />} />
        <Route path="candidates" element={<RecruiterCandidates />} />
        <Route path="roles" element={<RecruiterRoles />} />
        <Route path="company" element={<CompanyPage />} />
        <Route path="profile" element={<RecruiterProfile />} />
        <Route path="*" element={<Navigate to="/recruiter" replace />} />
      </Routes>
    </RecruiterLayout>
  );
}

interface DashboardProps {
  selectedClient: any;
}

function DashboardContent({ selectedClient }: DashboardProps) {
  const [showAddSubmission, setShowAddSubmission] = useState(false);
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [showDayDetails, setShowDayDetails] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [submissionStats, setSubmissionStats] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [ebesScore, setEbesScore] = useState<number>(0);
  const [searchName, setSearchName] = useState("");
  const [pipeline, setPipeline] = useState<{ counts: any; sla: any; focus: any[] } | null>(null);

  useEffect(() => {
    fetchData();
  }, [selectedClient, searchName]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchData();
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedClient, searchName]);

  const fetchData = async () => {
    try {
      const searchParam = searchName ? `&search_name=${encodeURIComponent(searchName)}` : '';
      const submissionsResponse = await fetchWithAuth(`/api/recruiter/submissions?client_id=${selectedClient.id}${searchParam}`);
      if (submissionsResponse.ok) {
        const submissionsData = await submissionsResponse.json();
        setSubmissionStats(submissionsData.stats);
        setSubmissions(submissionsData.submissions || []);
      }

      const ebesResponse = await fetchWithAuth(`/api/recruiter/ebes?filter=combined&client_id=${selectedClient.id}`);
      if (ebesResponse.ok) {
        const ebesData = await ebesResponse.json();
        setEbesScore(ebesData.score);
      }

      const pipelineRes = await fetchWithAuth(`/api/recruiter/pipeline?client_id=${selectedClient.id}`);
      if (pipelineRes.ok) {
        const pipelineData = await pipelineRes.json();
        setPipeline(pipelineData);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  const handleAddSubmission = () => {
    setSelectedDate(null);
    setShowAddSubmission(true);
  };

  const handleDateClick = (date: string) => {
    setSelectedDate(date);
    setShowDayDetails(true);
  };

  const handleAddEntryFromDayDetails = () => {
    // Close day details but keep selectedDate for AddSubmissionModal
    setShowDayDetails(false);
    setShowAddSubmission(true);
  };

  const getSubmissionsForDate = (date: string) => {
    return submissions.filter(sub => sub.submission_date === date);
  };

  const handleSubmissionSuccess = () => {
    fetchData();
  };

  return (
    <>
      {showDayDetails && selectedDate && !showAddSubmission && (
        <DayDetailsModal
          date={selectedDate}
          submissions={getSubmissionsForDate(selectedDate)}
          onClose={() => {
            setShowDayDetails(false);
            setSelectedDate(null);
          }}
          onAddEntry={handleAddEntryFromDayDetails}
        />
      )}

      {showAddSubmission && (
        <AddSubmissionModal
          client={selectedClient}
          selectedDate={selectedDate || undefined}
          onClose={() => {
            setShowAddSubmission(false);
            setSelectedDate(null);
          }}
          onSuccess={handleSubmissionSuccess}
        />
      )}

      {showQuickEntry && (
        <QuickEntryModal
          client={selectedClient}
          onClose={() => setShowQuickEntry(false)}
          onSuccess={handleSubmissionSuccess}
        />
      )}

      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold text-slate-800">Dashboard</h2>
          <div className="flex gap-3">
            <button
              onClick={handleAddSubmission}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Add Entry
            </button>
            <button
              onClick={() => setShowQuickEntry(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg font-medium hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg"
            >
              <Zap className="w-5 h-5" />
              Quick Deal/Dropout
            </button>
          </div>
        </div>

        

        {/* Pipeline and Calendar Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar - Takes up 2/3 of the space */}
          <div className="lg:col-span-2">
            <Calendar onDateClick={handleDateClick} submissions={submissions} />
          </div>

          {/* Performance Summary Sidebar - Takes up 1/3 of the space */}
          <div className="space-y-6">
            {/* Pipeline Overview */}
            {pipeline && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <BarChart3 className="w-6 h-6 text-indigo-600" />
                  <h3 className="text-xl font-bold text-slate-800">Pipeline Overview</h3>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="text-xs text-blue-600">Submissions</div>
                    <div className="text-2xl font-bold text-blue-900">{pipeline.counts.submissions}</div>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <div className="text-xs text-purple-600">Interviews</div>
                    <div className="text-2xl font-bold text-purple-900">{(pipeline.counts.interview_1 + pipeline.counts.interview_2 + pipeline.counts.interview_3)}</div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <div className="text-xs text-emerald-600">Deals</div>
                    <div className="text-2xl font-bold text-emerald-700">{pipeline.counts.deals}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-xs text-amber-700"><AlertTriangle className="w-4 h-4" /> No submission ≥7d</div>
                    <div className="text-xl font-bold text-amber-800">{pipeline.sla.roles_no_submission_7d}</div>
                  </div>
                  <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-xs text-rose-700"><AlertTriangle className="w-4 h-4" /> No interview ≥7d</div>
                    <div className="text-xl font-bold text-rose-800">{pipeline.sla.roles_no_interview_7d}</div>
                  </div>
                </div>
              </div>
            )}
            {/* This Month Summary */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-emerald-800 mb-3">This Month</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-emerald-700 font-semibold">{submissionStats?.total || 0} submissions</span>
                </div>
                <div className="text-sm text-emerald-600">
                  {submissionStats?.interviews || 0} interviews · {submissionStats?.deals || 0} deals closed
                </div>
              </div>
            </div>

            {/* EBES Score Section */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-blue-800 mb-3">EBES Score</h3>
              <div className="text-4xl font-bold text-blue-600 mb-2">
                {ebesScore.toFixed(1)}
              </div>
              <p className="text-sm text-blue-700">Current performance rating</p>
            </div>

            {/* Activity Rate */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-purple-800 mb-3">Activity Rate</h3>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl font-bold text-purple-600">
                  {submissionStats?.submission_6h && submissionStats?.total 
                    ? ((submissionStats.submission_6h / submissionStats.total) * 100).toFixed(0) 
                    : 0}%
                </span>
              </div>
              <p className="text-sm text-purple-700">Compared to last month</p>
            </div>
          </div>
        </div>

        {/* Today’s Focus */}
        {pipeline && pipeline.focus.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Target className="w-6 h-6 text-indigo-600" />
              <h3 className="text-xl font-bold text-slate-800">Today’s Focus</h3>
            </div>
            <div className="space-y-2">
              {pipeline.focus.slice(0, 5).map((item, idx) => (
                <div key={`${item.role_id}-${idx}`} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-semibold text-slate-800">{item.title}</div>
                    <div className="text-xs text-slate-500 font-mono">{item.role_code}</div>
                  </div>
                  <div className="text-xs font-semibold px-2 py-1 rounded-full border">
                    {item.reason}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity Feed - Scrolling Type */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">Recent Activity</h3>
                <p className="text-sm text-slate-500">Your latest entries for {selectedClient.name}</p>
              </div>
            </div>
            
            {/* Search by Candidate Name */}
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="Search by candidate name..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          {submissions.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl">
              <Briefcase className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">
                {searchName ? `No submissions found for "${searchName}"` : "No activity yet"}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {searchName ? "Try a different search term" : "Start by adding your first entry"}
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {submissions
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((entry) => {
                  const getEntryColor = (type: string) => {
                    switch (type) {
                      case 'submission': return 'bg-blue-50 border-blue-200 text-blue-700';
                      case 'interview': return 'bg-purple-50 border-purple-200 text-purple-700';
                      case 'deal': return 'bg-emerald-50 border-emerald-200 text-emerald-700';
                      case 'dropout': return 'bg-red-50 border-red-200 text-red-700';
                      default: return 'bg-slate-50 border-slate-200 text-slate-700';
                    }
                  };

                  const getEntryIcon = (type: string) => {
                    switch (type) {
                      case 'submission': return <CalendarDays className="w-4 h-4" />;
                      case 'interview': return <Users className="w-4 h-4" />;
                      case 'deal': return <TrendingUp className="w-4 h-4" />;
                      case 'dropout': return <Target className="w-4 h-4" />;
                      default: return <Briefcase className="w-4 h-4" />;
                    }
                  };

                  const formatDate = (dateStr: string) => {
                    const date = new Date(dateStr);
                    const today = new Date();
                    const diffTime = today.getTime() - date.getTime();
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (diffDays === 0) return 'Today';
                    if (diffDays === 1) return 'Yesterday';
                    if (diffDays < 7) return `${diffDays} days ago`;
                    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  };

                  return (
                    <div 
                      key={entry.id}
                      className={`border-2 rounded-lg p-3 ${getEntryColor(entry.entry_type)} transition-all hover:shadow-md`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${
                          entry.entry_type === 'submission' ? 'bg-blue-100' : 
                          entry.entry_type === 'interview' ? 'bg-purple-100' : 
                          entry.entry_type === 'deal' ? 'bg-emerald-100' : 'bg-red-100'
                        }`}>
                          {getEntryIcon(entry.entry_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-semibold text-slate-800 capitalize truncate">
                              {entry.entry_type === 'interview' 
                                ? `Level ${entry.interview_level} Interview`
                                : entry.entry_type}
                            </span>
                            <div className="flex items-center gap-1 text-xs text-slate-500 flex-shrink-0">
                              <Clock className="w-3 h-3" />
                              {formatDate(entry.created_at)}
                            </div>
                          </div>
                          {entry.candidate_name && (
                            <p className="text-sm font-semibold text-indigo-700 mb-1">
                              {entry.candidate_name}
                            </p>
                          )}
                          <div className="flex items-center gap-2">
                            <Briefcase className="w-3 h-3 text-slate-500 flex-shrink-0" />
                            <p className="text-sm text-slate-700 truncate">{entry.role_title}</p>
                          </div>
                          <p className="text-xs text-slate-500 font-mono mt-1">{entry.role_code}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
