import { HelpCircle } from 'lucide-react';
import { useState } from 'react';

interface ScoreTooltipProps {
  type: 'ebes' | 'performance';
  score?: number | null;
  label: string;
  className?: string;
}

export default function ScoreTooltip({ type, score, label, className = '' }: ScoreTooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Handle undefined, null, or NaN scores
  const displayScore = (score !== null && score !== undefined && !isNaN(score)) ? score : 0;

  const getTooltipText = () => {
    if (type === 'ebes') {
      return 'Your Employee Best Effort Score (EBES) reflects your overall performance in candidate submissions, interview progression, and successful deal closures. Higher scores indicate stronger performance across all recruitment activities.';
    } else {
      return 'Performance Score measures overall effectiveness based on role activity, interview progress, and successful outcomes. Higher scores indicate better performance and account health.';
    }
  };

  const getScoreInsight = () => {
    if (displayScore >= 80) return 'Excellent performance - keep up the great work!';
    if (displayScore >= 60) return 'Strong performance with room for growth.';
    if (displayScore >= 40) return 'Average performance - focus on improving key metrics.';
    if (displayScore > 0) return 'Performance needs attention - consider reviewing your approach.';
    return 'No activity recorded yet - start submitting candidates to build your score!';
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <div
        className="flex items-center gap-2 cursor-help"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className="flex items-center gap-2">
          <span className="text-4xl font-bold">{displayScore.toFixed(1)}</span>
          <HelpCircle className="w-5 h-5 text-gray-400 hover:text-gray-600 transition-colors" />
        </div>
      </div>

      {showTooltip && (
        <div className="absolute z-50 w-80 p-4 bg-gray-900 text-white text-sm rounded-lg shadow-xl -left-4 top-full mt-2">
          <div className="absolute -top-2 left-8 w-4 h-4 bg-gray-900 transform rotate-45"></div>
          <div className="space-y-2">
            <p className="font-semibold text-base">{type === 'ebes' ? 'EBES Score' : 'Performance Score'}: {displayScore.toFixed(1)} / 100</p>
            <p className="text-gray-300 leading-relaxed">{getTooltipText()}</p>
            <div className="pt-2 border-t border-gray-700">
              <p className="font-medium text-yellow-300">{getScoreInsight()}</p>
            </div>
            <div className="pt-2 border-t border-gray-700">
              <p className="text-xs text-gray-400">Performance Level: <span className="font-semibold text-white">{label}</span></p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
