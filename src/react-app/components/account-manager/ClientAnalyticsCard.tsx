import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Target } from "lucide-react";

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

interface ClientAnalyticsCardProps {
  client: ClientAnalytics;
}

export default function ClientAnalyticsCard({ client }: ClientAnalyticsCardProps) {
  const healthColors = {
    "Strong Account": "bg-green-100 text-green-700 border-green-200",
    "Average Account": "bg-yellow-100 text-yellow-700 border-yellow-200",
    "At Risk Account": "bg-red-100 text-red-700 border-red-200",
  };

  const healthIcons = {
    "Strong Account": <CheckCircle className="w-5 h-5 text-green-600" />,
    "Average Account": <Target className="w-5 h-5 text-yellow-600" />,
    "At Risk Account": <AlertTriangle className="w-5 h-5 text-red-600" />,
  };

  const GrowthIndicator = ({ value }: { value: number }) => {
    if (value > 0) {
      return (
        <div className="flex items-center gap-1 text-green-600">
          <TrendingUp className="w-4 h-4" />
          <span className="text-sm font-medium">+{value}%</span>
        </div>
      );
    } else if (value < 0) {
      return (
        <div className="flex items-center gap-1 text-red-600">
          <TrendingDown className="w-4 h-4" />
          <span className="text-sm font-medium">{value}%</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 text-gray-500">
        <Minus className="w-4 h-4" />
        <span className="text-sm font-medium">0%</span>
      </div>
    );
  };

  return (
    <div className="border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow bg-white">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900">{client.client_name}</h3>
          <p className="text-sm text-gray-600 font-mono mt-0.5">{client.client_code}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`px-4 py-2 rounded-full border text-sm font-medium flex items-center gap-2 ${healthColors[client.health_tag as keyof typeof healthColors]}`}>
            {healthIcons[client.health_tag as keyof typeof healthIcons]}
            {client.health_tag}
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-600">{client.health_score}</div>
            <div className="text-xs text-gray-500">Score</div>
          </div>
        </div>
      </div>

      {/* Overview Grid */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{client.total_roles}</p>
          <p className="text-xs text-gray-600 mt-1">Total Roles</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{client.deal_roles}</p>
          <p className="text-xs text-gray-600 mt-1">Deals</p>
        </div>
        <div className="bg-red-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-red-700">{client.lost_roles}</p>
          <p className="text-xs text-gray-600 mt-1">Lost</p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-yellow-700">{client.on_hold_roles}</p>
          <p className="text-xs text-gray-600 mt-1">On Hold</p>
        </div>
      </div>

      {/* Interview Performance */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Interview Performance</h4>
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center">
            <p className="text-xl font-bold text-indigo-600">{client.total_interviews}</p>
            <p className="text-xs text-gray-600">Total</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-indigo-600">{client.interview_1_count}</p>
            <p className="text-xs text-gray-600">1st Round</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-indigo-600">{client.interview_2_count}</p>
            <p className="text-xs text-gray-600">2nd Round</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-indigo-600">{client.interview_3_count}</p>
            <p className="text-xs text-gray-600">Final</p>
          </div>
        </div>
      </div>

      {/* Conversion Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-gray-600 mb-1">Roles → Deal Conversion</p>
          <p className="text-2xl font-bold text-blue-700">{client.roles_to_deal_conversion}%</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <p className="text-xs text-gray-600 mb-1">Interview → Deal Conversion</p>
          <p className="text-2xl font-bold text-purple-700">{client.interview_to_deal_conversion}%</p>
        </div>
      </div>

      {/* Monthly Comparison */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Monthly Comparison</h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-600">Roles Created</p>
              <GrowthIndicator value={client.roles_growth} />
            </div>
            <p className="text-sm">
              <span className="font-bold text-gray-900">{client.current_month.roles_created}</span>
              <span className="text-gray-500 text-xs"> / {client.last_month.roles_created}</span>
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-600">Interviews</p>
              <GrowthIndicator value={client.interviews_growth} />
            </div>
            <p className="text-sm">
              <span className="font-bold text-gray-900">{client.current_month.interviews}</span>
              <span className="text-gray-500 text-xs"> / {client.last_month.interviews}</span>
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-600">Deals</p>
              <GrowthIndicator value={client.deals_growth} />
            </div>
            <p className="text-sm">
              <span className="font-bold text-gray-900">{client.current_month.deals}</span>
              <span className="text-gray-500 text-xs"> / {client.last_month.deals}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Risk Indicators */}
      {(client.high_active_low_deals || client.high_interviews_no_closures || client.repeated_cancellations || client.consistent_closures) && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-900">Indicators</h4>
          {client.consistent_closures && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>Consistent deal closures</span>
            </div>
          )}
          {client.high_active_low_deals && (
            <div className="flex items-center gap-2 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>High active roles but low deals</span>
            </div>
          )}
          {client.high_interviews_no_closures && (
            <div className="flex items-center gap-2 text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>High interviews but no closures</span>
            </div>
          )}
          {client.repeated_cancellations && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Repeated role cancellations</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
