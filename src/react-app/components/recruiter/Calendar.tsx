import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

interface CalendarProps {
  onDateClick: (date: string) => void;
  submissions?: any[];
}

export default function Calendar({ onDateClick, submissions = [] }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek };
  };

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentDate);

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const formatDate = (day: number) => {
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    const dayStr = String(day).padStart(2, "0");
    return `${year}-${month}-${dayStr}`;
  };

  const getEntriesForDate = (date: string) => {
    const dateEntries = submissions.filter((sub) => sub.submission_date === date);
    return {
      total: dateEntries.length,
      submissions: dateEntries.filter(e => e.entry_type === 'submission').length,
      interviews: dateEntries.filter(e => e.entry_type === 'interview').length,
      deals: dateEntries.filter(e => e.entry_type === 'deal').length,
      dropouts: dateEntries.filter(e => e.entry_type === 'dropout').length,
    };
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
  };

  const isFutureDate = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date > today;
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-slate-800">
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={previousMonth}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
        </div>
      </div>

      {/* Day Names */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {dayNames.map((day) => (
          <div key={day} className="text-center text-sm font-semibold text-slate-500 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days */}
      <div className="grid grid-cols-7 gap-2">
        {/* Empty cells for days before month starts */}
        {Array.from({ length: startingDayOfWeek }).map((_, index) => (
          <div key={`empty-${index}`} className="aspect-square" />
        ))}

        {/* Days of the month */}
        {Array.from({ length: daysInMonth }).map((_, index) => {
          const day = index + 1;
          const date = formatDate(day);
          const entries = getEntriesForDate(date);
          const today = isToday(day);
          const future = isFutureDate(day);

          return (
            <button
              key={day}
              onClick={() => !future && onDateClick(date)}
              disabled={future}
              className={`aspect-square p-2 rounded-lg border-2 transition-all relative group ${
                today
                  ? "border-indigo-500 bg-indigo-50"
                  : future
                  ? "border-slate-200 bg-slate-50 cursor-not-allowed opacity-50"
                  : entries.total > 0
                  ? "border-blue-200 bg-blue-50 hover:border-blue-400 hover:bg-blue-100"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <div className="flex flex-col items-center justify-center h-full">
                <span
                  className={`text-sm font-semibold ${
                    today
                      ? "text-indigo-700"
                      : future
                      ? "text-slate-400"
                      : entries.total > 0
                      ? "text-blue-700"
                      : "text-slate-700"
                  }`}
                >
                  {day}
                </span>
                
                {/* Entry Type Indicators */}
                {entries.total > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap justify-center">
                    {entries.submissions > 0 && (
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" title={`${entries.submissions} submission${entries.submissions > 1 ? 's' : ''}`}></div>
                    )}
                    {entries.interviews > 0 && (
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-500" title={`${entries.interviews} interview${entries.interviews > 1 ? 's' : ''}`}></div>
                    )}
                    {entries.deals > 0 && (
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" title={`${entries.deals} deal${entries.deals > 1 ? 's' : ''}`}></div>
                    )}
                    {entries.dropouts > 0 && (
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500" title={`${entries.dropouts} dropout${entries.dropouts > 1 ? 's' : ''}`}></div>
                    )}
                  </div>
                )}
              </div>
              {!future && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-white bg-opacity-90 rounded-lg">
                  <Plus className="w-5 h-5 text-indigo-600" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-slate-200">
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-2 border-indigo-500 bg-indigo-50"></div>
            <span className="text-slate-600">Today</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-slate-600">Submission</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
            <span className="text-slate-600">Interview</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            <span className="text-slate-600">Deal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-slate-600">Dropout</span>
          </div>
        </div>
      </div>
    </div>
  );
}
