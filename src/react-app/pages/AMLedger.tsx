import { useState, useEffect } from "react";
import { FileText, Search, Filter, Download } from "lucide-react";
import { fetchWithAuth } from "@/react-app/utils/api";

export default function AMLedger() {
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'custom'>('month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [eventType, setEventType] = useState<'all' | 'submitted' | 'client_submitted' | 'client_rejected' | 'interview' | 'deal' | 'discarded' | 'dropout'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_play' | 'positive' | 'negative'>('all');
  const [loading, setLoading] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel' | 'pdf'>('csv');
  const [tableLoading, setTableLoading] = useState(false);
  const [entries, setEntries] = useState<Array<{
    event_date: string;
    event_type: string;
    candidate_name: string;
    role_title: string;
    role_code?: string;
    client_name: string;
    team_name: string;
    submission_type?: string;
    interview_level?: string;
    cv_match_percent?: string;
    notes?: string;
  }>>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 25 | 50 | 100>(25);
  const [total, setTotal] = useState(0);

  const exportLedger = async () => {
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
      params.append('format', exportFormat);
      const res = await fetchWithAuth(`/api/am/ledger/export?${params.toString()}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (exportFormat === 'pdf') {
          const w = window.open(url);
          if (!w) {
            const a = document.createElement('a');
            a.href = url;
            a.download = `am-submissions-ledger.html`;
            a.click();
          }
        } else {
          const a = document.createElement('a');
          a.href = url;
          a.download = exportFormat === 'excel' ? `am-submissions-ledger.xls` : `am-submissions-ledger.csv`;
          a.click();
        }
        URL.revokeObjectURL(url);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchLedger = async (targetPage?: number, targetPageSize?: number) => {
    setTableLoading(true);
    const params = new URLSearchParams();
    params.append('date_range', dateRange);
    if (dateRange === 'custom' && startDate && endDate) {
      params.append('start_date', startDate);
      params.append('end_date', endDate);
    }
    if (eventType !== 'all') params.append('event_type', eventType);
    if (statusFilter !== 'all') params.append('status', statusFilter);
    if (search.trim()) params.append('search', search.trim());
    const pg = targetPage ?? page;
    const ps = targetPageSize ?? pageSize;
    params.append('page', String(pg));
    params.append('page_size', String(ps));
    const res = await fetchWithAuth(`/api/am/ledger?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setEntries(data.events || []);
      setTotal(Number(data.total || 0));
    } else {
      setEntries([]);
      setTotal(0);
    }
    setTableLoading(false);
  };

  useEffect(() => {
    setPage(1);
    fetchLedger(1, pageSize);
  }, [dateRange, startDate, endDate, eventType, statusFilter, search]);
  useEffect(() => {
    fetchLedger(page, pageSize);
  }, [page, pageSize]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-emerald-600" />
          <h2 className="text-3xl font-bold text-slate-800">Submissions Ledger</h2>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as any)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            title="Export Format"
          >
            <option value="csv">CSV</option>
            <option value="excel">Excel</option>
            <option value="pdf">PDF</option>
          </select>
          <button
            onClick={exportLedger}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            disabled={loading}
            title="Export"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
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
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value as any)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            title="Event Type"
          >
            <option value="all">Event: All</option>
            <option value="submitted">Submitted to AM</option>
            <option value="client_submitted">Submitted to Client</option>
            <option value="client_rejected">Client Rejected</option>
            <option value="interview">Interview</option>
            <option value="deal">Deal</option>
            <option value="discarded">Discarded</option>
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
          <div className="flex items-center gap-3">
            <label className="text-sm text-slate-600">Rows</label>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value) as any);
                setPage(1);
              }}
              className="px-2 py-1 border border-slate-300 rounded text-sm"
              title="Rows per page"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
        <div className="p-4">
          {tableLoading ? (
            <div className="py-8 text-center text-slate-600">Loading...</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">No results</p>
              <p className="text-sm text-slate-500 mt-1">Adjust filters and try again</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="px-3 py-2 border-b w-32 sticky left-0 top-0 z-20 bg-white">Date</th>
                    <th className="px-3 py-2 border-b w-40 sticky left-32 top-0 z-20 bg-white">Event</th>
                    <th className="px-3 py-2 border-b">Candidate</th>
                    <th className="px-3 py-2 border-b">Role</th>
                    <th className="px-3 py-2 border-b">Client</th>
                    <th className="px-3 py-2 border-b">Team</th>
                    <th className="px-3 py-2 border-b">SubmissionType</th>
                    <th className="px-3 py-2 border-b">InterviewLevel</th>
                    <th className="px-3 py-2 border-b">CVMatchPercent</th>
                    <th className="px-3 py-2 border-b">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-3 py-2 w-32 sticky left-0 bg-white">{e.event_date}</td>
                      <td className="px-3 py-2 w-40 sticky left-32 bg-white">{e.event_type}</td>
                      <td className="px-3 py-2">{e.candidate_name}</td>
                      <td className="px-3 py-2">{`${e.role_title}${e.role_code ? ` (${e.role_code})` : ''}`}</td>
                      <td className="px-3 py-2">{e.client_name}</td>
                      <td className="px-3 py-2">{e.team_name}</td>
                      <td className="px-3 py-2">{e.submission_type || ''}</td>
                      <td className="px-3 py-2">{e.interview_level || ''}</td>
                      <td className="px-3 py-2">{e.cv_match_percent || ''}</td>
                      <td className="px-3 py-2">{e.notes || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between mt-3">
                <div className="text-sm text-slate-600">
                  {entries.length === 0 ? "Showing 0 of 0" : `Showing ${(page - 1) * pageSize + 1}-${(page - 1) * pageSize + entries.length} of ${total}`}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="px-3 py-1 border rounded disabled:opacity-50"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Prev
                  </button>
                  <span className="text-sm">{page}</span>
                  <button
                    className="px-3 py-1 border rounded disabled:opacity-50"
                    onClick={() => setPage((p) => ((p * pageSize) < total ? p + 1 : p))}
                    disabled={page * pageSize >= total}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
