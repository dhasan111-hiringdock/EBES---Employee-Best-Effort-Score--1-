import { Link } from "react-router";
import { useEffect, useState } from "react";
import { BarChart3, Gauge, Clock, CheckCircle, ShieldCheck, Target, Users, Building2 } from "lucide-react";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Brush, ComposedChart, Line, Area, Legend } from "recharts";

const submissionQuality = [
  { name: "Screening", value: 45 },
  { name: "Interview", value: 28 },
  { name: "Offer", value: 12 },
  { name: "Hire", value: 8 },
];

const timelinessDist = [
  { name: "Same Day", value: 55, color: "#10b981" },
  { name: "24–48h", value: 35, color: "#f59e0b" },
  { name: ">48h", value: 10, color: "#64748b" },
];

const heroTrend = [
  { month: "Jan", interviews: 38, deals: 9, ebes: 71 },
  { month: "Feb", interviews: 46, deals: 11, ebes: 74 },
  { month: "Mar", interviews: 52, deals: 13, ebes: 77 },
  { month: "Apr", interviews: 49, deals: 12, ebes: 76 },
  { month: "May", interviews: 57, deals: 14, ebes: 79 },
  { month: "Jun", interviews: 61, deals: 16, ebes: 82 },
];

const conversionFunnel = [
  { stage: "L1", count: 120 },
  { stage: "L2", count: 72 },
  { stage: "L3", count: 41 },
  { stage: "Deal", count: 18 },
];

const statusDist = [
  { name: "Active", value: 28, color: "#10b981" },
  { name: "Deal", value: 9, color: "#3b82f6" },
  { name: "On Hold", value: 6, color: "#f59e0b" },
  { name: "Lost", value: 4, color: "#ef4444" },
  { name: "Cancelled", value: 2, color: "#64748b" },
  { name: "No Answer", value: 3, color: "#8b5cf6" },
];



function HeroDashboardMock() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-md p-5 transition-transform hover:shadow-lg hover:scale-[1.01]">
      <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={heroTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" stroke="#64748b" />
            <YAxis stroke="#64748b" />
            <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px' }} />
            <Legend />
            <Area type="monotone" dataKey="interviews" name="Interviews" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
            <Bar dataKey="deals" name="Deals" fill="#10b981" />
            <Line type="monotone" dataKey="ebes" name="EBES" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <CheckCircle className="w-5 h-5" />
          <span className="text-sm font-medium">EBES 74.2</span>
        </div>
        <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <Clock className="w-5 h-5" />
          <span className="text-sm font-medium">On-Time 92%</span>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">Sample data shown for illustration only</p>
    </div>
  );
}

export default function EBESLanding() {
  const [apiStatus, setApiStatus] = useState<"loading" | "ok" | "fail">("loading");
  useEffect(() => {
    const base = (import.meta as any)?.env?.VITE_API_BASE_URL || (typeof window !== "undefined" && window.location && window.location.origin.includes("localhost") ? "http://localhost:8787" : "https://ebes-app.dhasan111.workers.dev");
    fetch(`${base}/api/health`).then(res => {
      setApiStatus(res.ok ? "ok" : "fail");
    }).catch(() => setApiStatus("fail"));
  }, []);
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 relative">
      <div
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{
          background:
            "radial-gradient(600px 300px at 10% 0%, rgba(15,23,42,0.06), transparent 60%), radial-gradient(500px 250px at 90% 10%, rgba(15,23,42,0.05), transparent 60%)",
        }}
        aria-hidden="true"
      />
      <header className="sticky top-0 z-10 backdrop-blur bg-white/80 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center">
              <Target className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-slate-900">EBES</span>
          </div>
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1 rounded-lg border text-xs font-medium ${apiStatus === "ok" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : apiStatus === "fail" ? "bg-red-50 border-red-200 text-red-700" : "bg-slate-100 border-slate-200 text-slate-700"}`}>
              {apiStatus === "loading" ? "Checking API..." : apiStatus === "ok" ? "API Connected" : "API Offline"}
            </div>
            <Link
              to="/login"
              className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              Login
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="max-w-7xl mx-auto px-6 py-16 md:py-20 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium mb-4">
              <span>Enterprise SaaS for recruiting performance</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 leading-tight">
              Measure effort. Improve performance. Build accountability.
            </h1>
            <p className="mt-4 text-lg text-slate-600">
              EBES (Employee Best Effort Score) transforms recruiter actions into clear, trustworthy performance insights for agencies and HR teams.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm font-medium">Trusted metrics</span>
              </div>
              <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <Clock className="w-5 h-5" />
                <span className="text-sm font-medium">Timeliness built-in</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <ShieldCheck className="w-5 h-5" />
                <span className="text-sm font-medium">Privacy-first</span>
              </div>
            </div>
            <div className="mt-6">
              <a href="#previews" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-slate-300 text-slate-800 hover:border-slate-900 transition-colors">
                <BarChart3 className="w-4 h-4" />
                <span className="text-sm font-medium">View sample dashboards</span>
              </a>
            </div>
          </div>
          <HeroDashboardMock />
        </section>

        {/* Dashboard Preview */}
        <section id="previews" className="max-w-7xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Dashboard Preview</h2>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                <p className="text-sm font-medium text-emerald-700">EBES</p>
                <p className="text-2xl font-bold text-emerald-700">{(heroTrend[heroTrend.length - 1]?.ebes ?? 0).toFixed(1)}</p>
              </div>
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-center">
                <p className="text-sm font-medium text-indigo-700">Interviews</p>
                <p className="text-2xl font-bold text-indigo-700">{heroTrend[heroTrend.length - 1]?.interviews ?? 0}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                <p className="text-sm font-medium text-blue-700">Deals</p>
                <p className="text-2xl font-bold text-blue-700">{heroTrend[heroTrend.length - 1]?.deals ?? 0}</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                <p className="text-sm font-medium text-amber-700">On-Time</p>
                <p className="text-2xl font-bold text-amber-700">{timelinessDist[0]?.value ?? 0}%</p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={heroTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="interviews" name="Interviews" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                    <Bar dataKey="deals" name="Deals" fill="#10b981" />
                    <Line type="monotone" dataKey="ebes" name="EBES" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={statusDist} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={80} labelLine={false}>
                      {statusDist.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={conversionFunnel} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" stroke="#64748b" />
                    <YAxis dataKey="stage" type="category" stroke="#64748b" />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" />
                    <Brush dataKey="stage" height={16} travellerWidth={8} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={submissionQuality}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip />
                    <Bar dataKey="value" fill="#0f172a" />
                    <Brush dataKey="name" height={16} travellerWidth={8} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="max-w-7xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-md transition-all duration-200">
              <div className="flex items-center gap-2 mb-2">
                <Gauge className="w-5 h-5 text-slate-700" />
                <span className="font-semibold text-slate-800">Effort Score</span>
              </div>
              <p className="text-slate-600 text-sm">Quantifies actions into a single score to compare effort across teams.</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-md transition-all duration-200">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-5 h-5 text-slate-700" />
                <span className="font-semibold text-slate-800">Submission Quality</span>
              </div>
              <p className="text-slate-600 text-sm">Tracks candidate screening, interview progression, and hiring outcomes.</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-md transition-all duration-200">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-slate-700" />
                <span className="font-semibold text-slate-800">Timeliness</span>
              </div>
              <p className="text-slate-600 text-sm">Measures speed-to-action and SLA alignment across recruiting workflows.</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-md transition-all duration-200">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-5 h-5 text-slate-700" />
                <span className="font-semibold text-slate-800">Consistency Index</span>
              </div>
              <p className="text-slate-600 text-sm">Evaluates steady performance over time for reliable delivery.</p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="max-w-7xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-md transition-all duration-200">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-slate-700" />
                <span className="font-semibold text-slate-800">Track actions</span>
              </div>
              <p className="text-slate-600 text-sm">Capture submissions, interviews, offers, and hires.</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-md transition-all duration-200">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5 text-slate-700" />
                <span className="font-semibold text-slate-800">Convert into scores</span>
              </div>
              <p className="text-slate-600 text-sm">Normalize metrics into EBES scores you can trust.</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-md transition-all duration-200">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-5 h-5 text-slate-700" />
                <span className="font-semibold text-slate-800">Gain performance insights</span>
              </div>
              <p className="text-slate-600 text-sm">Spot strengths and gaps across agencies, teams, and roles.</p>
            </div>
          </div>
        </section>

        {/* Audience */}
        <section className="max-w-7xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Who Benefits</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-md transition-all duration-200">
              <p className="text-slate-800 font-semibold">Recruitment Agencies</p>
              <p className="text-slate-600 text-sm mt-1">Improve delivery reliability and client trust.</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-md transition-all duration-200">
              <p className="text-slate-800 font-semibold">HR Teams</p>
              <p className="text-slate-600 text-sm mt-1">Benchmark recruiters and vendors objectively.</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-md transition-all duration-200">
              <p className="text-slate-800 font-semibold">Operations & Delivery Managers</p>
              <p className="text-slate-600 text-sm mt-1">Identify bottlenecks and optimize throughput.</p>
            </div>
          </div>
        </section>

        {/* Anonymized Testimonials */}
        <section className="max-w-7xl mx-auto px-6 py-12">
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-2xl p-6 md:p-8">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-5 h-5 text-slate-800" />
              <h2 className="text-2xl font-bold text-slate-900">What Leaders Say</h2>
            </div>
            <p className="text-slate-600 text-sm mb-4">Anonymized examples, not real company data</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  quote:
                    "EBES helped us quantify effort and improve SLA adherence without revealing sensitive data.",
                  role: "Operations Lead, Agency Z",
                },
                {
                  quote:
                    "Clear scoring and consistency metrics drove more predictable delivery week over week.",
                  role: "HR Manager, Enterprise Y",
                },
                {
                  quote:
                    "Objective insights aligned teams around quality and timeliness standards.",
                  role: "Delivery Manager, Global X",
                },
              ].map((t, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                  <p className="text-slate-800 text-sm">{t.quote}</p>
                  <p className="mt-3 text-slate-500 text-xs">{t.role}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 mt-8">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-slate-600">EBES ©</p>
          <div className="flex items-center gap-4 text-sm">
            <a href="#" className="text-slate-600 hover:text-slate-900 transition-colors">Privacy Policy</a>
            <a href="#" className="text-slate-600 hover:text-slate-900 transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
