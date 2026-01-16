const DEFAULT_API_BASE = 'https://ebes-app.dhasan111.workers.dev';
const DEV_BASE = typeof window !== 'undefined' && window.location && window.location.origin.includes('localhost')
  ? 'http://localhost:8787'
  : undefined;
const LS_BASE = typeof window !== 'undefined' ? (localStorage.getItem('api_base') || undefined) : undefined;
const API_BASE: string = (import.meta as any)?.env?.VITE_API_BASE_URL ?? LS_BASE ?? DEV_BASE ?? DEFAULT_API_BASE;
const requestCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5000; // 5 seconds cache for GET requests

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
  const fullUrl = isAbsolute ? url : (API_BASE ? `${API_BASE}${url}` : url);
  
  // Clear entire cache on any mutation to ensure fresh data
  if (method !== 'GET') {
    requestCache.clear();
  }
  
  if (method === 'GET') {
    const cacheKey = `${method}:${fullUrl}`;
    const cached = requestCache.get(cacheKey);
    
    // Check if cache exists and is still valid
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      // Return a new Response object with the cached data
      return new Response(JSON.stringify(cached.data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Make the actual fetch request
    const response = await fetch(fullUrl, fetchOptions);
    
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

  return fetch(fullUrl, fetchOptions);
}

export async function reportBotQuery(query: string, startDate?: string, endDate?: string): Promise<Response> {
  return fetchWithAuth(`/api/reports/bot/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, start_date: startDate, end_date: endDate }),
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
