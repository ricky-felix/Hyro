import { config } from '../config';
import { supabase } from './supabase';
import { isDemoMode } from './appMode';
import { demoRequest } from './demoApi';

/**
 * Base API client with authentication support
 */
class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
  }

  async request(endpoint, options = {}) {
    // Demo mode (gate password) never touches the real backend.
    if (isDemoMode()) {
      const body = options.body ? JSON.parse(options.body) : undefined;
      return demoRequest(options.method ?? 'GET', endpoint, body);
    }

    const headers = await this.getAuthHeaders();
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      const err = new Error(error.message || `HTTP ${response.status}`);
      // Lets callers (e.g. the offline outbox) tell a permanent rejection
      // (4xx — bad request, forbidden, not found) from a transient one
      // (network failure, 5xx) without parsing the message string.
      err.status = response.status;
      throw err;
    }

    // Handle 204 No Content responses
    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  patch(endpoint, data) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  delete(endpoint, data) {
    return this.request(endpoint, {
      method: 'DELETE',
      ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
    });
  }
}

export const api = new ApiClient(config.apiUrl);
