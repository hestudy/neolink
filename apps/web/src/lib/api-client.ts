// Real HTTP client for development with JWT auth support
const API_BASE_URL = 'http://localhost:8000/api/v1';

const getAuthToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('authToken');
  }
  return null;
};

const makeRequest = async (endpoint: string, options: RequestInit = {}) => {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.message || errorData.error || 'Request failed');
  }

  return response.json();
};

export const api = {
  bookmarks: {
    list: async () => {
      const result = await makeRequest('/bookmarks');
      return result.data || [];
    },
    get: async ({ id }: { id: string }) => {
      const result = await makeRequest(`/bookmarks/${id}`);
      return result.data;
    },
    create: async (data: any) => {
      const result = await makeRequest('/bookmarks', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return result.data;
    },
    update: async ({ id, ...data }: any) => {
      const result = await makeRequest(`/bookmarks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      return result.data;
    },
    delete: async ({ id }: { id: string }) => {
      const result = await makeRequest(`/bookmarks/${id}`, {
        method: 'DELETE',
      });
      return result;
    },
  },

  // Authentication methods
  auth: {
    setToken: (token: string) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('authToken', token);
      }
    },
    getToken: getAuthToken,
    clearToken: () => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('authToken');
      }
    },
  },
};

// Mock API client for development
export const mockApi = api;
