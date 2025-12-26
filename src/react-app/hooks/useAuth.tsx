import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';

interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'recruiter' | 'account_manager' | 'recruitment_manager' | 'super_admin';
  user_code: string;
  is_active: boolean;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => {
    // Initialize state from localStorage immediately
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        return JSON.parse(storedUser);
      } catch {
        localStorage.removeItem('user');
        return null;
      }
    }
    return null;
  });
  const loading = false;
  const navigate = useNavigate();

  const logout = useCallback(() => {
    localStorage.removeItem('user');
    setUser(null);
    navigate('/login');
  }, [navigate]);

  return useMemo(() => ({ user, loading, logout }), [user, loading, logout]);
}

export function useRequireAuth(allowedRoles?: string[]) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login', { replace: true });
    } else if (!loading && user && allowedRoles && !allowedRoles.includes(user.role)) {
      // Redirect to appropriate dashboard
      const roleRoutes: Record<string, string> = {
        super_admin: '/super-admin',
        admin: '/admin',
        recruiter: '/recruiter',
        account_manager: '/am',
        recruitment_manager: '/rm',
      };
      navigate(roleRoutes[user.role] || '/login', { replace: true });
    }
  }, [user, loading, allowedRoles, navigate]);

  return { user, loading };
}
