/**
 * Local API client — Base44-compatible surface for the Remote Ops Manager UI.
 * Talks to the Express + SQLite backend in /server.
 */

const TOKEN_KEY = 'rom_access_token';

function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || localStorage.getItem('base44_access_token') || null;
  } catch {
    return null;
  }
}

function setToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      // Keep legacy key cleared so old Base44 tokens are not reused
      localStorage.removeItem('base44_access_token');
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('base44_access_token');
    }
  } catch {
    // ignore
  }
}

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, { ...options, headers });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const message = (data && data.error) || res.statusText || 'Request failed';
    throw new ApiError(message, res.status, data);
  }
  return data;
}

function createEntityApi(entityType) {
  return {
    list(sort, limit) {
      const params = new URLSearchParams();
      if (sort) params.set('sort', sort);
      if (limit != null) params.set('limit', String(limit));
      const qs = params.toString();
      return request(`/api/entities/${entityType}${qs ? `?${qs}` : ''}`);
    },
    filter(filter = {}, sort, limit) {
      return request(`/api/entities/${entityType}/filter`, {
        method: 'POST',
        body: JSON.stringify({ filter, sort, limit }),
      });
    },
    create(data) {
      return request(`/api/entities/${entityType}`, {
        method: 'POST',
        body: JSON.stringify(data || {}),
      });
    },
    update(id, data) {
      return request(`/api/entities/${entityType}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data || {}),
      });
    },
    delete(id) {
      return request(`/api/entities/${entityType}/${id}`, { method: 'DELETE' });
    },
    subscribe(callback) {
      const token = getToken();
      if (!token || typeof EventSource === 'undefined') {
        // Fallback polling
        let stopped = false;
        const tick = async () => {
          if (stopped) return;
          try {
            callback({ type: 'poll' });
          } catch {
            // ignore
          }
          if (!stopped) setTimeout(tick, 5000);
        };
        setTimeout(tick, 5000);
        return () => { stopped = true; };
      }

      const url = `/api/entities/${entityType}/subscribe?access_token=${encodeURIComponent(token)}`;
      const es = new EventSource(url);
      const onChange = (evt) => {
        try {
          const payload = evt.data ? JSON.parse(evt.data) : { type: 'change' };
          callback(payload);
        } catch {
          callback({ type: 'change' });
        }
      };
      es.addEventListener('change', onChange);
      es.onerror = () => {
        // browser will retry EventSource automatically
      };
      return () => {
        es.removeEventListener('change', onChange);
        es.close();
      };
    },
  };
}

const ENTITY_NAMES = [
  'Shoot',
  'RigSetting',
  'Rig',
  'User',
  'PendingUser',
  'AppSettings',
  'UserPresence',
  'StandbyDay',
  'OperatorAvailability',
  'TimeEntry',
  'PaymentRecord',
  'ShootReport',
  'RigTest',
  'ReferenceImage',
  'Report',
  'Event',
  'ShootNotification',
];

const entities = Object.fromEntries(ENTITY_NAMES.map((name) => [name, createEntityApi(name)]));

export const api = {
  entities,
  auth: {
    async me() {
      return request('/api/auth/me');
    },
    async login(email, password) {
      const result = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(result.token);
      return result.user;
    },
    async register({ email, password, full_name }) {
      const result = await request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, full_name }),
      });
      setToken(result.token);
      return result.user;
    },
    async updateMe(data) {
      return request('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify(data || {}),
      });
    },
    async logout(redirectUrl) {
      try {
        await request('/api/auth/logout', { method: 'POST' });
      } catch {
        // ignore
      }
      setToken(null);
      // Pass false to skip redirect (matches previous SDK usage patterns)
      if (redirectUrl === false) return;
      window.location.href = '/login';
    },
    redirectToLogin() {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login?next=${next}`;
    },
    getToken,
    setToken,
  },
  users: {
    inviteUser(email, role = 'user') {
      return request('/api/users/invite', {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      });
    },
  },
  integrations: {
    Core: {
      async UploadFile({ file }) {
        const form = new FormData();
        form.append('file', file);
        return request('/api/upload', { method: 'POST', body: form });
      },
    },
  },
  appLogs: {
    logUserInApp(pageName) {
      return request('/api/app-logs', {
        method: 'POST',
        body: JSON.stringify({ pageName }),
      });
    },
  },
  google: {
    status() {
      return request('/api/google/status');
    },
    authUrl() {
      return request('/api/google/auth-url');
    },
    disconnect() {
      return request('/api/google/disconnect', { method: 'POST' });
    },
    calendars() {
      return request('/api/google/calendars');
    },
    saveSettings({ calendarId }) {
      return request('/api/google/settings', {
        method: 'PATCH',
        body: JSON.stringify({ calendarId }),
      });
    },
    sync() {
      return request('/api/google/sync', { method: 'POST' });
    },
  },
};

// Compatibility export used across existing UI files
export const base44 = api;
export { getToken, setToken, ApiError };
