import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, MessageSquare, Loader2, Send, X } from "lucide-react";
import { reportBotQuery } from "@/react-app/utils/api";
import { seedBotData, clearBotData } from "@/react-app/utils/api";
import { useAuth } from "@/react-app/hooks/useAuth";

type BotAnswer = {
  success: boolean;
  intent?: string;
  period?: { start?: string; end?: string };
  answer?: { count?: number; items?: any[]; columns?: string[] };
  error?: string;
};

export default function ReportBotWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BotAnswer | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const W = window as any;
    const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
    setVoiceSupported(!!SR);
    if (SR && !recRef.current) {
      recRef.current = new SR();
      recRef.current.continuous = false;
      recRef.current.lang = "en-US";
      recRef.current.interimResults = true;
      recRef.current.maxAlternatives = 3;
      recRef.current.onresult = (e: any) => {
        try {
          let interim = "";
          let finalText = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i];
            const t = r[0] && r[0].transcript ? r[0].transcript : "";
            if (t) {
              if (r.isFinal) finalText += t;
              else interim += t;
            }
          }
          const tInterim = interim.trim();
          const tFinal = finalText.trim();
          if (tInterim) setQuery((prev) => (prev ? `${prev} ${tInterim}` : tInterim));
          if (tFinal) {
            setQuery((prev) => (prev ? `${prev} ${tFinal}` : tFinal));
            if (!loading) setTimeout(() => send(), 100);
          }
        } catch {}
      };
      recRef.current.onstart = () => {
        setSpeaking(true);
      };
      recRef.current.onend = () => {
        setSpeaking(false);
      };
      recRef.current.onaudioend = () => {
        setSpeaking(false);
      };
      recRef.current.onspeechend = () => {
        setSpeaking(false);
      };
      recRef.current.onerror = (e: any) => {
        const err = e?.error ? String(e.error) : "Speech error";
        let msg = err;
        if (err === "not-allowed") msg = "Microphone permission blocked in browser privacy settings";
        else if (err === "audio-capture") msg = "No microphone detected";
        else if (err === "no-speech") msg = "No speech detected, try again";
        setVoiceError(msg);
        setSpeaking(false);
      };
    }
  }, []);

  const startSpeech = async () => {
    if (!voiceSupported || !recRef.current) {
      setVoiceError("Voice input not supported on this browser");
      return;
    }
    setVoiceError(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    } catch {
      setVoiceError("Microphone permission denied");
    }
    try {
      recRef.current.start();
      setSpeaking(true);
    } catch {
      setVoiceError("Could not start listening");
      setSpeaking(false);
    }
  };
  const stopSpeech = () => {
    if (recRef.current && speaking) {
      try {
        recRef.current.stop();
      } catch {}
    }
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop();
      streamRef.current = null;
    }
    setSpeaking(false);
  };

  const send = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await reportBotQuery(query.trim(), startDate || undefined, endDate || undefined);
      const data = await res.json().catch(() => null);
      setResult(data || { success: false, error: "Invalid response" });
    } catch {
      setResult({ success: false, error: "Failed to fetch" });
    } finally {
      setLoading(false);
    }
  };

  const quick = async (q: string) => {
    setQuery(q);
    setStartDate("");
    setEndDate("");
    await send();
  };

  const roleLabel =
    user?.role === "account_manager"
      ? "AM"
      : user?.role === "recruitment_manager"
      ? "RM"
      : user?.role === "recruiter"
      ? "Recruiter"
      : user?.role === "admin"
      ? "Admin"
      : "User";

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all"
          title="Report Bot"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      )}
      {open && (
        <div className="w-[28rem] max-w-[90vw] bg-white rounded-2xl shadow-2xl border border-slate-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              <div className="text-slate-800 font-semibold">Report Bot Agent</div>
              <div className="text-xs text-slate-500">({roleLabel})</div>
            </div>
            <div className="flex items-center gap-2">
              {user?.role === "admin" && import.meta.env.DEV && (
                <>
                  <button
                    onClick={async () => {
                      try {
                        const res = await seedBotData();
                        if (res.ok) {
                          const data = await res.json().catch(() => null);
                          const roles = Number((data as any)?.inserted_roles || 0);
                          const submissions = Number((data as any)?.inserted_submissions || 0);
                          setResult({
                            success: true,
                            intent: "seed_data",
                            answer: {
                              count: roles + submissions,
                              items: [
                                { metric: "inserted_roles", value: roles },
                                { metric: "inserted_submissions", value: submissions },
                              ],
                              columns: ["metric", "value"],
                            },
                          });
                        }
                      } catch {}
                    }}
                    className="px-2 py-1 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    title="Seed test data"
                  >
                    Seed
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const res = await clearBotData();
                        if (res.ok) {
                          setResult({ success: true, intent: "clear_data", answer: { count: 0 } });
                        }
                      } catch {}
                    }}
                    className="px-2 py-1 rounded-lg border border-red-300 text-red-700 hover:bg-red-50"
                    title="Clear test data"
                  >
                    Clear
                  </button>
                </>
              )}
              <button
                onPointerDown={startSpeech}
                onPointerUp={stopSpeech}
                onMouseDown={startSpeech}
                onMouseUp={stopSpeech}
                onClick={() => {
                  if (speaking) stopSpeech();
                  else startSpeech();
                }}
                disabled={!voiceSupported}
                className={`px-2 py-1 rounded-lg border ${speaking ? "border-red-300 text-red-600 hover:bg-red-50" : "border-slate-300 text-slate-700 hover:bg-slate-50"} ${!voiceSupported ? "opacity-50 cursor-not-allowed" : ""}`}
                title={speaking ? "Release to stop" : "Hold to speak"}
              >
                {speaking ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  setQuery("");
                  setResult(null);
                  setStartDate("");
                  setEndDate("");
                  stopSpeech();
                }}
                className="text-slate-400 hover:text-slate-600"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
              </div>

              <div className="p-4 space-y-3">
                <div className="flex gap-2">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ask to count, list, or search roles, deals, interviews"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  <button
                    onClick={send}
                    disabled={loading || !query.trim()}
                    className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                    title="Send"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    <span className="text-sm">Ask</span>
                  </button>
                </div>
                {voiceError && (
                  <div className="text-xs text-red-600">{voiceError}</div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => quick("How many roles are on hold this year?")}
                    className="px-2 py-1 text-xs rounded-full border border-slate-300 hover:bg-slate-50"
              >
                On hold this year
              </button>
              <button
                onClick={() => quick("How many roles have I worked with this month?")}
                className="px-2 py-1 text-xs rounded-full border border-slate-300 hover:bg-slate-50"
              >
                Worked with this month
              </button>
              <button
                onClick={() => quick("What I must start")}
                className="px-2 py-1 text-xs rounded-full border border-slate-300 hover:bg-slate-50"
              >
                Must start
              </button>
              <button
                onClick={() => quick("List roles this month")}
                className="px-2 py-1 text-xs rounded-full border border-slate-300 hover:bg-slate-50"
              >
                Browse roles this month
              </button>
              <button
                onClick={() => quick("List deals this year")}
                className="px-2 py-1 text-xs rounded-full border border-slate-300 hover:bg-slate-50"
              >
                Deals this year
              </button>
              <button
                onClick={() => quick("List interviews last month")}
                className="px-2 py-1 text-xs rounded-full border border-slate-300 hover:bg-slate-50"
              >
                Interviews last month
              </button>
              <button
                onClick={() => quick("Search roles engineer")}
                className="px-2 py-1 text-xs rounded-full border border-slate-300 hover:bg-slate-50"
              >
                Search roles: engineer
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500">Start date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500">End date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>

            {result && (
              <div className="mt-2 border border-slate-200 rounded-lg p-3 bg-slate-50">
                {!result.success ? (
                  <div className="text-sm text-red-600">{result.error || "Failed to get report"}</div>
                ) : (
                  <div className="space-y-1">
                    <div className="text-sm text-slate-700">
                      Intent: <span className="font-semibold">{result.intent}</span>
                    </div>
                    {result.period && (result.period.start || result.period.end) && (
                      <div className="text-xs text-slate-500">
                        Period {result.period.start || ""} {result.period.end ? `to ${result.period.end}` : ""}
                      </div>
                    )}
                    {result.answer && typeof result.answer.count === "number" && (
                      <div className="text-lg font-bold text-slate-800">
                        {typeof result.answer.count === "number" ? result.answer.count : ""}
                      </div>
                    )}
                    {result.answer && Array.isArray(result.answer.items) && result.answer.items.length > 0 && (
                      <div className="mt-2">
                        <div className="overflow-auto max-h-64 border border-slate-200 rounded">
                          <table className="min-w-full text-xs">
                            <thead className="bg-slate-100">
                              <tr>
                                {(() => {
                                  const items = result.answer?.items || [];
                                  const cols = result.answer?.columns || (items[0] ? Object.keys(items[0]) : []);
                                  return cols.map((col) => (
                                    <th key={col} className="px-2 py-1 text-left text-slate-600 font-semibold">{col}</th>
                                  ));
                                })()}
                              </tr>
                            </thead>
                            <tbody>
                              {(result.answer?.items || []).slice(0, 10).map((row: any, idx: number) => (
                                <tr key={idx} className="border-t border-slate-200">
                                  {(() => {
                                    const items = result.answer?.items || [];
                                    const cols = result.answer?.columns || (items[0] ? Object.keys(items[0]) : []);
                                    return cols.map((col) => (
                                      <td key={col} className="px-2 py-1 text-slate-700">{String(row[col] ?? "")}</td>
                                    ));
                                  })()}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
