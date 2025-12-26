import { useState, useEffect } from "react";
import { AlertCircle, CheckCircle, Target, Users, Award } from "lucide-react";
import ClientAnalyticsCard from "./ClientAnalyticsCard";
import ScoreTooltip from "@/react-app/components/shared/ScoreTooltip";
import { fetchWithAuth } from "@/react-app/utils/api";

interface ClientAnalytics {
  client_id: number;
  client_name: string;
  client_code: string;
  total_roles: number;
  active_roles: number;
  deal_roles: number;
  lost_roles: number;
  on_hold_roles: number;
  cancelled_roles: number;
  no_answer_roles: number;
  total_interviews: number;
  interview_1_count: number;
  interview_2_count: number;
  interview_3_count: number;
  roles_to_deal_conversion: number;
  interview_to_deal_conversion: number;
  stage_1_to_2_dropoff: number;
  stage_2_to_3_dropoff: number;
  current_month: {
    roles_created: number;
    interviews: number;
    deals: number;
    lost: number;
  };
  last_month: {
    roles_created: number;
    interviews: number;
    deals: number;
    lost: number;
  };
  roles_growth: number;
  interviews_growth: number;
  deals_growth: number;
  health_score: number;
  health_tag: string;
  high_active_low_deals: boolean;
  high_interviews_no_closures: boolean;
  consistent_closures: boolean;
  repeated_cancellations: boolean;
}

interface AnalyticsSummary {
  total_clients: number;
  strong_accounts: number;
  average_accounts: number;
  at_risk_accounts: number;
}

export default function Analytics() {
  const [analytics, setAnalytics] = useState<ClientAnalytics[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [ebesScore, setEbesScore] = useState<{ score: number; performance_label: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "strong" | "average" | "at_risk">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    fetchAnalytics();
    fetchEBESScore();
  }, [startDate, endDate]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      let url = "/api/am/analytics";
      
      if (startDate && endDate) {
        url += `?start_date=${startDate}&end_date=${endDate}`;
      }
      
      const response = await fetchWithAuth(url);
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data.clients);
        setSummary(data.summary);
      }
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEBESScore = async () => {
    try {
      let url = "/api/am/ebes-score";
      
      if (startDate && endDate) {
        url += `?start_date=${startDate}&end_date=${endDate}`;
      }
      
      const response = await fetchWithAuth(url);
      if (response.ok) {
        const data = await response.json();
        setEbesScore(data);
      }
    } catch (error) {
      console.error("Failed to fetch EBES score:", error);
    }
  };

  const handleClearDates = () => {
    setStartDate("");
    setEndDate("");
  };

  const filteredAnalytics = analytics.filter((client) => {
    if (filter === "all") return true;
    if (filter === "strong") return client.health_tag === "Strong Account";
    if (filter === "average") return client.health_tag === "Average Account";
    if (filter === "at_risk") return client.health_tag === "At Risk Account";
    return true;
  });

  const totalActiveRoles = analytics.reduce((sum, c) => sum + c.active_roles, 0);
  const totalDeals = analytics.reduce((sum, c) => sum + c.deal_roles, 0);
  const totalInterviews = analytics.reduce((sum, c) => sum + c.total_interviews, 0);
  const totalLost = analytics.reduce((sum, c) => sum + c.lost_roles, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Client Performance Analytics</h2>
        <p className="text-gray-600 mt-1">Comprehensive insights into your client accounts</p>
      </div>

      {/* Date Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Date Range Filter</h3>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          {(startDate || endDate) && (
            <button
              onClick={handleClearDates}
              className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
            >
              Clear Dates
            </button>
          )}
        </div>
        {startDate && endDate && (
          <p className="text-sm text-indigo-600 mt-3">
            Showing data from {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* EBES Score Display */}
      {ebesScore && (
        <div className={`bg-gradient-to-br rounded-xl p-8 text-white shadow-2xl ${
          ebesScore.performance_label === "Excellent"
            ? "from-green-500 to-green-600"
            : ebesScore.performance_label === "Strong"
            ? "from-blue-500 to-blue-600"
            : ebesScore.performance_label === "Average"
            ? "from-yellow-500 to-yellow-600"
            : "from-red-500 to-red-600"
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Award className="w-8 h-8" />
                <h3 className="text-2xl font-bold">Your EBES Score</h3>
              </div>
              <div className="mt-4">
                <ScoreTooltip 
                  type="ebes" 
                  score={ebesScore.score} 
                  label={ebesScore.performance_label}
                  className="text-white"
                />
              </div>
              <div className="flex items-center gap-2 mt-4">
                <span className="px-4 py-2 bg-white bg-opacity-20 rounded-full text-sm font-semibold backdrop-blur-sm">
                  {ebesScore.performance_label}
                </span>
              </div>
            </div>
            <div className="text-right opacity-90">
              <p className="text-sm mb-2">Performance Rating</p>
              <div className="text-4xl">
                {ebesScore.performance_label === "Excellent" && "🌟"}
                {ebesScore.performance_label === "Strong" && "💪"}
                {ebesScore.performance_label === "Average" && "📊"}
                {ebesScore.performance_label === "At Risk" && "⚠️"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Total Clients</p>
              <p className="text-3xl font-bold mt-1">{summary?.total_clients || 0}</p>
            </div>
            <Users className="w-10 h-10 text-blue-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Strong Accounts</p>
              <p className="text-3xl font-bold mt-1">{summary?.strong_accounts || 0}</p>
            </div>
            <CheckCircle className="w-10 h-10 text-green-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-100 text-sm">Average Accounts</p>
              <p className="text-3xl font-bold mt-1">{summary?.average_accounts || 0}</p>
            </div>
            <Target className="w-10 h-10 text-yellow-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm">At Risk</p>
              <p className="text-3xl font-bold mt-1">{summary?.at_risk_accounts || 0}</p>
            </div>
            <AlertCircle className="w-10 h-10 text-red-200" />
          </div>
        </div>
      </div>

      {/* Overall Metrics */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Performance</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-indigo-600">{totalActiveRoles}</p>
            <p className="text-sm text-gray-600 mt-1">Active Roles</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-green-600">{totalDeals}</p>
            <p className="text-sm text-gray-600 mt-1">Total Deals</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600">{totalInterviews}</p>
            <p className="text-sm text-gray-600 mt-1">Total Interviews</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-red-600">{totalLost}</p>
            <p className="text-sm text-gray-600 mt-1">Lost Roles</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex overflow-x-auto">
            <button
              onClick={() => setFilter("all")}
              className={`px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                filter === "all"
                  ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              All Clients ({analytics.length})
            </button>
            <button
              onClick={() => setFilter("strong")}
              className={`px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                filter === "strong"
                  ? "text-green-600 border-b-2 border-green-600 bg-green-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              Strong ({summary?.strong_accounts || 0})
            </button>
            <button
              onClick={() => setFilter("average")}
              className={`px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                filter === "average"
                  ? "text-yellow-600 border-b-2 border-yellow-600 bg-yellow-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              Average ({summary?.average_accounts || 0})
            </button>
            <button
              onClick={() => setFilter("at_risk")}
              className={`px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                filter === "at_risk"
                  ? "text-red-600 border-b-2 border-red-600 bg-red-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              At Risk ({summary?.at_risk_accounts || 0})
            </button>
          </div>
        </div>

        <div className="p-6">
          {filteredAnalytics.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No clients found in this category</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAnalytics.map((client) => (
                <ClientAnalyticsCard key={client.client_id} client={client} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
