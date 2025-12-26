import { useState } from "react";
import { X } from "lucide-react";

interface Role {
  id: number;
  role_code: string;
  title: string;
  interview_1_count: number;
  interview_2_count: number;
  interview_3_count: number;
  total_interviews: number;
}

interface AddInterviewModalProps {
  role: Role;
  onClose: () => void;
  onInterviewAdded: () => void;
}

export default function AddInterviewModal({
  role,
  onClose,
  onInterviewAdded,
}: AddInterviewModalProps) {
  const [interviewRound, setInterviewRound] = useState<number>(1);
  const [interviewCount, setInterviewCount] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/am/roles/${role.id}/interviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interview_round: interviewRound,
          interview_count: interviewCount,
        }),
      });

      if (response.ok) {
        onInterviewAdded();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to add interview entry");
      }
    } catch (err) {
      setError("An error occurred while adding the interview entry");
    } finally {
      setLoading(false);
    }
  };

  const rounds = [
    { value: 1, label: "1st Interview (First Round)", current: role.interview_1_count },
    { value: 2, label: "2nd Interview (Second Round)", current: role.interview_2_count },
    { value: 3, label: "3rd Interview (Final Round)", current: role.interview_3_count },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Add Interview Entry</h3>
            <p className="text-sm text-gray-600 mt-1">{role.title}</p>
            <p className="text-xs text-gray-500 font-mono mt-0.5">{role.role_code}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-indigo-700 font-medium mb-2">Current Interview Count</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xl font-bold text-indigo-600">{role.interview_1_count}</p>
              <p className="text-xs text-indigo-700">1st Round</p>
            </div>
            <div>
              <p className="text-xl font-bold text-indigo-600">{role.interview_2_count}</p>
              <p className="text-xs text-indigo-700">2nd Round</p>
            </div>
            <div>
              <p className="text-xl font-bold text-indigo-600">{role.interview_3_count}</p>
              <p className="text-xs text-indigo-700">Final</p>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-indigo-200">
            <p className="text-xs text-indigo-700 text-center">
              Total: <span className="font-bold">{role.total_interviews}</span>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Interview Round *
            </label>
            <div className="space-y-2">
              {rounds.map((round) => (
                <button
                  key={round.value}
                  type="button"
                  onClick={() => setInterviewRound(round.value)}
                  className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                    interviewRound === round.value
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{round.label}</span>
                    <span className="text-sm text-gray-600">
                      Current: <strong>{round.current}</strong>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of Interviews *
            </label>
            <input
              type="number"
              value={interviewCount}
              onChange={(e) => setInterviewCount(parseInt(e.target.value, 10))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              min="1"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              How many interviews to add for this round
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {loading ? "Adding..." : "Add Entry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
