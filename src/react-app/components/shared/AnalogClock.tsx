import { useState, useEffect } from 'react';
import { Clock, Globe } from 'lucide-react';

const TIMEZONES = [
  { label: 'UTC', value: 'UTC' },
  { label: 'US Eastern', value: 'America/New_York' },
  { label: 'US Central', value: 'America/Chicago' },
  { label: 'US Mountain', value: 'America/Denver' },
  { label: 'US Pacific', value: 'America/Los_Angeles' },
  { label: 'London', value: 'Europe/London' },
  { label: 'Paris', value: 'Europe/Paris' },
  { label: 'Berlin', value: 'Europe/Berlin' },
  { label: 'Moscow', value: 'Europe/Moscow' },
  { label: 'Dubai', value: 'Asia/Dubai' },
  { label: 'Mumbai', value: 'Asia/Kolkata' },
  { label: 'Singapore', value: 'Asia/Singapore' },
  { label: 'Tokyo', value: 'Asia/Tokyo' },
  { label: 'Sydney', value: 'Australia/Sydney' },
];

export default function AnalogClock() {
  const [time, setTime] = useState(new Date());
  const [showTimezoneModal, setShowTimezoneModal] = useState(false);
  const [timezone, setTimezone] = useState(() => {
    return localStorage.getItem('userTimezone') || 'UTC';
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleTimezoneChange = (newTimezone: string) => {
    setTimezone(newTimezone);
    localStorage.setItem('userTimezone', newTimezone);
    setShowTimezoneModal(false);
  };

  // Get time components in selected timezone
  const getTimeInTimezone = () => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });

    const parts = formatter.formatToParts(time);
    const hours = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const minutes = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
    const seconds = parseInt(parts.find(p => p.type === 'second')?.value || '0');

    return { hours, minutes, seconds };
  };

  const { hours, minutes, seconds } = getTimeInTimezone();

  // Calculate rotation angles (0 degrees = 12 o'clock)
  const secondAngle = seconds * 6; // 6 degrees per second
  const minuteAngle = minutes * 6 + seconds * 0.1; // 6 degrees per minute + smooth movement
  const hourAngle = ((hours % 12) * 30) + (minutes * 0.5); // 30 degrees per hour + smooth movement

  const timeString = time.toLocaleString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: timezone,
    hour12: true
  });

  const selectedTz = TIMEZONES.find(tz => tz.value === timezone);

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setShowTimezoneModal(true)}
          className="group relative bg-white rounded-2xl shadow-lg border-2 border-slate-200 hover:border-indigo-300 transition-all p-4 hover:shadow-xl w-full"
        >
          {/* Clock Face */}
          <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-slate-50 to-slate-100 border-4 border-slate-300 relative shadow-inner">
            {/* Hour markers */}
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-3 bg-slate-400 rounded-full"
                style={{
                  left: '50%',
                  top: '10px',
                  transform: `translateX(-50%) rotate(${i * 30}deg)`,
                  transformOrigin: `center ${64 - 10}px`,
                }}
              />
            ))}

            {/* Center dot */}
            <div className="absolute top-1/2 left-1/2 w-3 h-3 bg-slate-800 rounded-full transform -translate-x-1/2 -translate-y-1/2 z-20" />

            {/* Hour hand */}
            <div
              className="absolute left-1/2 top-1/2 origin-[50%_100%]"
              style={{
                width: '4px',
                height: '32px',
                backgroundColor: '#1e293b',
                borderRadius: '2px',
                transform: `translate(-50%, -100%) rotate(${hourAngle}deg)`,
              }}
            />

            {/* Minute hand */}
            <div
              className="absolute left-1/2 top-1/2 origin-[50%_100%]"
              style={{
                width: '2px',
                height: '44px',
                backgroundColor: '#334155',
                borderRadius: '1px',
                transform: `translate(-50%, -100%) rotate(${minuteAngle}deg)`,
              }}
            />

            {/* Second hand */}
            <div
              className="absolute left-1/2 top-1/2 origin-[50%_100%]"
              style={{
                width: '2px',
                height: '48px',
                backgroundColor: '#ef4444',
                borderRadius: '1px',
                transform: `translate(-50%, -100%) rotate(${secondAngle}deg)`,
                transition: 'transform 0.2s cubic-bezier(0.4, 0.0, 0.2, 1)',
              }}
            />
          </div>

          {/* Digital time and timezone */}
          <div className="mt-3 text-center">
            <div className="text-sm font-bold text-slate-800 font-mono">{timeString}</div>
            <div className="flex items-center justify-center gap-1 mt-1 text-xs text-slate-500">
              <Globe className="w-3 h-3" />
              <span>{selectedTz?.label || 'UTC'}</span>
            </div>
          </div>

          {/* Hover hint */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/5 rounded-2xl transition-all pointer-events-none">
            <span className="opacity-0 group-hover:opacity-100 text-xs text-slate-600 font-medium bg-white/90 px-3 py-1 rounded-lg">
              Click to change timezone
            </span>
          </div>
        </button>
      </div>

      {/* Timezone Selection Modal */}
      {showTimezoneModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowTimezoneModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
                <Globe className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">Select Timezone</h3>
                <p className="text-sm text-slate-500">Choose your preferred timezone</p>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2 mb-6">
              {TIMEZONES.map((tz) => {
                const currentTimeInTz = time.toLocaleString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: tz.value,
                  hour12: true
                });
                
                return (
                  <button
                    key={tz.value}
                    onClick={() => handleTimezoneChange(tz.value)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                      timezone === tz.value
                        ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium">{tz.label}</div>
                        <div className="text-xs mt-0.5 opacity-80">{tz.value}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono">{currentTimeInTz}</span>
                        {timezone === tz.value && (
                          <Clock className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setShowTimezoneModal(false)}
              className="w-full px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-medium transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
