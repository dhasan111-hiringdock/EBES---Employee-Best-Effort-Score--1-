// Optimized API utility with request deduplication
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
  
  // Clear entire cache on any mutation to ensure fresh data
  if (method !== 'GET') {
    requestCache.clear();
  }
  
  if (method === 'GET') {
    const cacheKey = `${method}:${url}`;
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
    const response = await fetch(url, fetchOptions);
    
    // Only cache successful responses
    if (response.ok) {
      try {
        // Clone and cache the response data
        const responseClone = response.clone();
        const data = await responseClone.json();
        requestCache.set(cacheKey, { data, timestamp: Date.now() });

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

  return fetch(url, fetchOptions);
}
