import { useState } from "react";
import { FileText, Search, Filter, Download } from "lucide-react";
import { fetchWithAuth } from "@/react-app/utils/api";

export default function RecruiterLedger() {
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'custom'>('month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [eventType, setEventType] = useState<'all' | 'submission' | 'rm_evaluation' | 'submitted_to_am' | 'client_submitted' | 'client_rejected' | 'interview' | 'deal' | 'discarded' | 'restored' | 'dropout'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_play' | 'positive' | 'negative'>('all');
  const [loading, setLoading] = useState(false);

  const exportCsv = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('date_range', dateRange);
      if (dateRange === 'custom' && startDate && endDate) {
        params.append('start_date', startDate);
        params.append('end_date', endDate);
      }
      if (eventType !== 'all') params.append('event_type', eventType);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (search.trim()) params.append('search', search.trim());
      const res = await fetchWithAuth(`/api/recruiter/ledger/export?${params.toString()}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `submissions-ledger.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-600" />
          <h2 className="text-3xl font-bold text-slate-800">Submissions Ledger</h2>
        </div>
        <button
          onClick={exportCsv}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          disabled={loading}
          title="Export CSV"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by candidate, role, client..."
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value as any)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            title="Event Type"
          >
            <option value="all">Event: All</option>
            <option value="submission">Submission</option>
            <option value="rm_evaluation">Pending Evaluation</option>
            <option value="submitted_to_am">Submitted to AM</option>
            <option value="client_submitted">Submitted to Client</option>
            <option value="client_rejected">Client Rejected</option>
            <option value="interview">Interview</option>
            <option value="deal">Deal</option>
            <option value="discarded">Discarded</option>
            <option value="restored">Restored</option>
            <option value="dropout">Dropout</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            title="Status"
          >
            <option value="all">Status: All</option>
            <option value="in_play">In Play</option>
            <option value="positive">Positive</option>
            <option value="negative">Negative</option>
          </select>
          <div className="grid grid-cols-3 gap-2">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              title="Date Range"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="custom">Custom</option>
            </select>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              disabled={dateRange !== 'custom'}
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              disabled={dateRange !== 'custom'}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-700">
            <Filter className="w-4 h-4" />
            <span className="text-sm">Filtered results</span>
          </div>
        </div>
        <div className="p-4">
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">No results yet</p>
            <p className="text-sm text-slate-500 mt-1">Adjust filters or implement API to load ledger entries</p>
          </div>
        </div>
      </div>
    </div>
  );
}
