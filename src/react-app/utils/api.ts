const DEFAULT_API_BASE = 'https://ebes-app.dhasan111.workers.dev';
const DEV_BASE = typeof window !== 'undefined' && window.location && (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
  ? 'http://127.0.0.1:8787'
  : undefined;
function resolveApiBase(): string {
  const envBase = (import.meta as any)?.env?.VITE_API_BASE_URL;
  const lsBase = typeof window !== 'undefined' ? (localStorage.getItem('api_base') || undefined) : undefined;
  let base = envBase ?? lsBase ?? DEV_BASE ?? DEFAULT_API_BASE;
  if (
    typeof window !== 'undefined' &&
    window.location &&
    (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
  ) {
    if (base && base.includes('localhost:5173')) {
      base = DEV_BASE ?? DEFAULT_API_BASE;
      try {
        localStorage.setItem('api_base', base);
      } catch {}
    }
  }
  return base;
}
export function getApiBase(): string {
  return resolveApiBase();
}
const requestCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5000; // 5 seconds cache for GET requests
let lastUserId: string | undefined;

export async function fetchWithAuth(url: string, options?: RequestInit): Promise<Response> {
  const user = localStorage.getItem('user');
  
  if (!user) {
    throw new Error('No user session found');
  }

  let userId: string;
  try {
    const userData = JSON.parse(user);
    userId = userData.id?.toString();
    if (!userId) {
      throw new Error('Invalid user data');
    }
  } catch (error) {
    localStorage.removeItem('user');
    throw new Error('Invalid session');
  }

  if (userId !== lastUserId) {
    requestCache.clear();
    lastUserId = userId;
  }

  const headers = {
    'Content-Type': 'application/json',
    'x-user-id': userId,
    ...options?.headers,
  };

  const fetchOptions: RequestInit = {
    ...options,
    headers,
  };

  // Implement request deduplication for GET requests
  const method = options?.method?.toUpperCase() || 'GET';
  const isAbsolute = url.startsWith('http://') || url.startsWith('https://');
  const fullUrl = isAbsolute ? url : (resolveApiBase() ? `${resolveApiBase()}${url}` : url);
  
  // Clear entire cache on any mutation to ensure fresh data
  if (method !== 'GET') {
    requestCache.clear();
  }
  
  if (method === 'GET') {
    const cacheKey = `${method}:${fullUrl}:uid:${userId}`;
    const cached = requestCache.get(cacheKey);
    
    // Check if cache exists and is still valid
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      // Return a new Response object with the cached data
      return new Response(JSON.stringify(cached.data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let response: Response;
    try {
      response = await fetch(fullUrl, fetchOptions);
    } catch {
      if (!isAbsolute && resolveApiBase() === DEV_BASE) {
        const fallbackUrl = `${DEFAULT_API_BASE}${url}`;
        try {
          localStorage.setItem('api_base', DEFAULT_API_BASE);
        } catch {}
        response = await fetch(fallbackUrl, fetchOptions);
      } else {
        throw new Error('Network error');
      }
    }
    
    // Only cache successful responses
    if (response.ok) {
      try {
        // Clone and cache the response data
        const responseClone = response.clone();
        const ct = responseClone.headers.get('content-type') || '';
        const isJson = ct.includes('application/json');
        const data = isJson ? await responseClone.json() : null;
        if (data !== null) {
          requestCache.set(cacheKey, { data, timestamp: Date.now() });
        }

        // Clean up old cache entries
        setTimeout(() => {
          requestCache.delete(cacheKey);
        }, CACHE_DURATION);
      } catch (error) {
        // If caching fails, just continue without caching
        console.warn('Failed to cache response:', error);
      }
    }

    return response;
  }

  try {
    return await fetch(fullUrl, fetchOptions);
  } catch {
    if (!isAbsolute && resolveApiBase() === DEV_BASE) {
      const fallbackUrl = `${DEFAULT_API_BASE}${url}`;
      try {
        localStorage.setItem('api_base', DEFAULT_API_BASE);
      } catch {}
      return await fetch(fallbackUrl, fetchOptions);
    }
    throw new Error('Network error');
  }
}

export async function fetchPublic(url: string, options?: RequestInit): Promise<Response> {
  const isAbsolute = url.startsWith('http://') || url.startsWith('https://');
  const fullUrl = isAbsolute ? url : (resolveApiBase() ? `${resolveApiBase()}${url}` : url);
  return fetch(fullUrl, options ?? {});
}

export async function reportBotQuery(query: string, startDate?: string, endDate?: string): Promise<Response> {
  return fetchWithAuth(`/api/reports/bot/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, start_date: startDate, end_date: endDate }),
  });
}

export async function seedBotData(): Promise<Response> {
  return fetchWithAuth(`/api/admin/test/seed-bot-data`, {
    method: 'POST',
    headers: {
      ...(import.meta.env.DEV ? { 'x-dev-allow': '1' } : {}),
    }
  });
}

export async function clearBotData(): Promise<Response> {
  return fetchWithAuth(`/api/admin/test/clear-bot-data`, {
    method: 'POST',
    headers: {
      ...(import.meta.env.DEV ? { 'x-dev-allow': '1' } : {}),
    }
  });
}

export async function rmReviewSubmission(submissionId: number, body: any): Promise<Response> {
  return fetchWithAuth(`/api/rm/submissions/${submissionId}/review`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function rmReviewByRoleCandidate(roleId: number, candidateId: number, body: any): Promise<Response> {
  return fetchWithAuth(`/api/rm/roles/${roleId}/candidates/${candidateId}/review`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function rmSendCandidateToAM(roleId: number, candidateId: number): Promise<Response> {
  return fetchWithAuth(`/api/rm/roles/${roleId}/candidates/${candidateId}/send-to-am`, {
    method: 'POST',
  });
}

export async function rmDiscardCandidate(roleId: number, candidateId: number, reason?: string): Promise<Response> {
  return fetchWithAuth(`/api/rm/roles/${roleId}/candidates/${candidateId}/discard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
}

export async function amSubmitCandidateToClient(roleId: number, candidateId: number): Promise<Response> {
  return fetchWithAuth(`/api/am/roles/${roleId}/candidates/${candidateId}/submit-to-client`, {
    method: 'POST',
  });
}

export async function amClientRejectCandidate(roleId: number, candidateId: number): Promise<Response> {
  return fetchWithAuth(`/api/am/roles/${roleId}/candidates/${candidateId}/client-reject`, {
    method: 'POST',
  });
}

export async function amMarkDeal(roleId: number, candidateId: number): Promise<Response> {
  return fetchWithAuth(`/api/am/roles/${roleId}/candidates/${candidateId}/deal`, {
    method: 'POST',
  });
}

export async function amDiscardCandidate(roleId: number, candidateId: number, reason?: string): Promise<Response> {
  return fetchWithAuth(`/api/am/roles/${roleId}/candidates/${candidateId}/discard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
}

export async function amReviewSubmission(submissionId: number, body: any): Promise<Response> {
  return fetchWithAuth(`/api/am/submissions/${submissionId}/review`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function amPullOutCandidate(roleId: number, candidateId: number): Promise<Response> {
  return fetchWithAuth(`/api/am/roles/${roleId}/candidates/${candidateId}/pull-out`, {
    method: 'POST',
  });
}

export async function getRmRoleSubmissions(roleId: number): Promise<Response> {
  return fetchWithAuth(`/api/rm/role-submissions/${roleId}`);
}

export async function getAmRoleSubmissions(roleId: number): Promise<Response> {
  return fetchWithAuth(`/api/am/role-submissions/${roleId}`);
}

export async function recruiterDiscardCandidateFromRole(roleId: number, candidateId: number, reason?: string): Promise<Response> {
  return fetchWithAuth(`/api/recruiter/candidates/${candidateId}/roles/${roleId}/discard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
}

export async function getRecruiterRoleSubmissions(roleId: number): Promise<Response> {
  return fetchWithAuth(`/api/recruiter/role-submissions/${roleId}`);
}

export async function recruiterMarkDeal(roleId: number, candidateId: number): Promise<Response> {
  return fetchWithAuth(`/api/recruiter/roles/${roleId}/candidates/${candidateId}/deal`, {
    method: 'POST',
  });
}

export async function recruiterSeedSampleData(perRole?: number, clientId?: number, teamId?: number): Promise<Response> {
  return fetchWithAuth(`/api/recruiter/seed/sample-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      per_role: perRole,
      client_id: clientId,
      team_id: teamId,
    }),
  });
}

export async function rmUpdateRoleStatus(roleId: number, status: string, closing_reason?: string | null): Promise<Response> {
  return fetchWithAuth(`/api/rm/roles/${roleId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, closing_reason: closing_reason ?? null }),
  });
}
