import { useState, useEffect } from "react";
import { Calendar, TrendingUp, Award } from "lucide-react";
import ScoreTooltip from "@/react-app/components/shared/ScoreTooltip";
import { fetchWithAuth } from "@/react-app/utils/api";

export default function EBESScore() {
  const [score, setScore] = useState<number>(0);
  const [performanceLabel, setPerformanceLabel] = useState<string>("Average");
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<"current" | "last" | "custom">("current");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  useEffect(() => {
    fetchEBESScore();
  }, [dateFilter, customStartDate, customEndDate]);

  const fetchEBESScore = async () => {
    setLoading(true);
    try {
      let url = "/api/am/ebes-score";
      
      if (dateFilter === "current") {
        // Current month
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        url += `?start_date=${startOfMonth.toISOString().split('T')[0]}&end_date=${endOfMonth.toISOString().split('T')[0]}`;
      } else if (dateFilter === "last") {
        // Last month
        const now = new Date();
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        
        url += `?start_date=${startOfLastMonth.toISOString().split('T')[0]}&end_date=${endOfLastMonth.toISOString().split('T')[0]}`;
      } else if (dateFilter === "custom" && customStartDate && customEndDate) {
        url += `?start_date=${customStartDate}&end_date=${customEndDate}`;
      }
      
      const response = await fetchWithAuth(url);
      if (response.ok) {
        const data = await response.json();
        setScore(data.score);
        setPerformanceLabel(data.performance_label);
      }
    } catch (error) {
      console.error("Failed to fetch EBES score:", error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = () => {
    if (performanceLabel === "Excellent") return "from-green-500 to-emerald-600";
    if (performanceLabel === "Strong") return "from-blue-500 to-indigo-600";
    if (performanceLabel === "At Risk") return "from-red-500 to-rose-600";
    return "from-yellow-500 to-amber-600";
  };

  const getScoreTextColor = () => {
    if (performanceLabel === "Excellent") return "text-green-600";
    if (performanceLabel === "Strong") return "text-blue-600";
    if (performanceLabel === "At Risk") return "text-red-600";
    return "text-yellow-600";
  };

  const getScoreBgColor = () => {
    if (performanceLabel === "Excellent") return "bg-green-50 border-green-200";
    if (performanceLabel === "Strong") return "bg-blue-50 border-blue-200";
    if (performanceLabel === "At Risk") return "bg-red-50 border-red-200";
    return "bg-yellow-50 border-yellow-200";
  };

  const getDateLabel = () => {
    if (dateFilter === "current") {
      const now = new Date();
      return `Current Month - ${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
    } else if (dateFilter === "last") {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      return `Last Month - ${lastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
    } else if (dateFilter === "custom" && customStartDate && customEndDate) {
      return `${new Date(customStartDate).toLocaleDateString()} - ${new Date(customEndDate).toLocaleDateString()}`;
    }
    return "Select Date Range";
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">EBES Score</h2>
        <p className="text-gray-600 mt-1">Your Employee Best Effort Score performance metric</p>
      </div>

      {/* Date Filter Selection */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Time Period</h3>
        </div>
        
        <div className="flex flex-wrap gap-3 mb-4">
          <button
            onClick={() => setDateFilter("current")}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              dateFilter === "current"
                ? "bg-indigo-600 text-white shadow-md"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Current Month
          </button>
          <button
            onClick={() => setDateFilter("last")}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              dateFilter === "last"
                ? "bg-indigo-600 text-white shadow-md"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Last Month
          </button>
          <button
            onClick={() => setDateFilter("custom")}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              dateFilter === "custom"
                ? "bg-indigo-600 text-white shadow-md"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Custom Range
          </button>
        </div>

        {dateFilter === "custom" && (
          <div className="flex flex-wrap items-end gap-4 mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        )}

        <p className="text-sm text-gray-600 mt-4">
          {getDateLabel()}
        </p>
      </div>

      {/* EBES Score Display */}
      <div className={`bg-gradient-to-br ${getScoreColor()} rounded-2xl shadow-2xl p-8 text-white`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Award className="w-10 h-10 text-white/80" />
            <h3 className="text-2xl font-bold">Monthly EBES Score</h3>
          </div>
          <TrendingUp className="w-8 h-8 text-white/60" />
        </div>
        
        <div className="text-center mb-8">
          <ScoreTooltip 
            type="ebes" 
            score={score} 
            label={performanceLabel}
            className="text-white"
          />
          <div className="text-xl font-semibold text-white/90 mt-4">
            out of 100
          </div>
        </div>

        <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 text-center">
          <p className="text-sm text-white/80 uppercase tracking-wide mb-2">Performance Rating</p>
          <p className="text-3xl font-bold">{performanceLabel}</p>
        </div>
      </div>

      {/* Performance Label Card */}
      <div className={`rounded-xl border-2 p-6 ${getScoreBgColor()}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 font-medium mb-1">Current Performance Level</p>
            <p className={`text-2xl font-bold ${getScoreTextColor()}`}>
              {performanceLabel}
            </p>
          </div>
          <div className={`text-5xl font-black ${getScoreTextColor()} opacity-20`}>
            {score.toFixed(0)}
          </div>
        </div>
      </div>
    </div>
  );
}
