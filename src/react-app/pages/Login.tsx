import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Target, Mail, Lock, AlertCircle } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [accountChoices, setAccountChoices] = useState<any[]>([]);
  const DEFAULT_API_BASE = 'https://ebes-app.dhasan111.workers.dev';
  const DEV_BASE = typeof window !== 'undefined' && window.location && window.location.origin.includes('localhost')
    ? 'http://localhost:8787'
    : undefined;
  const API_BASE: string = (import.meta as any)?.env?.VITE_API_BASE_URL ?? DEV_BASE ?? DEFAULT_API_BASE;

  const getFinancialYearLabel = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const startYear = month < 4 ? year - 1 : year;
      const endYear = month < 4 ? year : year + 1;
      return `${startYear}-${endYear}`;
    } catch {
      return '';
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Clear any existing session first
    localStorage.clear();

    try {
      const loginUrl = API_BASE ? `${API_BASE}/api/auth/login` : '/api/auth/login';
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const ct = response.headers.get('content-type') || '';
      const isJson = ct.includes('application/json');
      const data = isJson ? await response.json() : null;

      if (response.ok) {
        const accounts = (data as any)?.users || ((data as any)?.user ? [(data as any).user] : []);
        if (accounts.length > 1) {
          setAccountChoices(accounts);
        } else if (accounts.length === 1) {
          localStorage.setItem('user', JSON.stringify(accounts[0]));
          const roleRoutes: Record<string, string> = {
            super_admin: '/super-admin',
            admin: '/admin',
            recruiter: '/recruiter',
            account_manager: '/am',
            recruitment_manager: '/rm',
          };
          const route = roleRoutes[accounts[0].role];
          if (route) {
            navigate(route, { replace: true });
          } else {
            setError('Invalid user role');
          }
        } else {
          setError('Invalid login response');
        }
      } else {
        setError((data as any)?.error || (isJson ? 'Invalid email or password' : 'Service not available. Please try again later.'));
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-xl mb-4">
            <Target className="w-12 h-12 text-indigo-600" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">EBES</h1>
          <p className="text-indigo-100 text-lg">Employee Best Effort Score</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">Welcome Back</h2>
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {accountChoices.length > 1 && (
            <div className="mt-6 bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-700 mb-3">Select an account to continue</p>
              <div className="space-y-2">
                {accountChoices.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      localStorage.setItem('user', JSON.stringify(u));
                      const roleRoutes: Record<string, string> = {
                        super_admin: '/super-admin',
                        admin: '/admin',
                        recruiter: '/recruiter',
                        account_manager: '/am',
                        recruitment_manager: '/rm',
                      };
                      const route = roleRoutes[u.role];
                      navigate(route, { replace: true });
                    }}
                    className="w-full flex items-center justify-between px-4 py-2 border rounded-lg hover:bg-slate-50"
                  >
                    <span className="text-slate-800 font-medium">{u.name}</span>
                    <span className="text-slate-500 text-sm font-mono">
                      {u.user_code} • {u.role.replace('_',' ')}
                      {u.created_at ? ` • FY ${getFinancialYearLabel(u.created_at)}` : ''}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              Contact your administrator if you need access
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-indigo-100">
            © 2024 EBES. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
