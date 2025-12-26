import { Calendar, AlertCircle } from "lucide-react";

interface MonthlyReminderModalProps {
  onConfirm: () => void;
  onSkip: () => void;
}

export default function MonthlyReminderModal({ onConfirm, onSkip }: MonthlyReminderModalProps) {
  const currentMonth = new Date().toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-scale-in">
        <div className="flex items-center justify-center mb-6">
          <div className="p-4 bg-indigo-100 rounded-full">
            <Calendar className="w-8 h-8 text-indigo-600" />
          </div>
        </div>

        <h3 className="text-2xl font-bold text-gray-900 text-center mb-3">
          Monthly Data Update
        </h3>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-900 mb-1">
                Is the previous month's data updated?
              </p>
              <p className="text-sm text-yellow-700">
                Please ensure all interview counts and role statuses are up to date for{" "}
                {currentMonth}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onSkip}
            className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Skip
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            Yes, Updated
          </button>
        </div>

        <p className="text-xs text-gray-500 text-center mt-4">
          If you skip, this reminder will appear again at your next login
        </p>
      </div>
    </div>
  );
}
