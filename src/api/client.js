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
        setTimeout(tick, 4000);
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
  'Report',
  'Event',
  'ShootNotification',
  'CalendarChangeRequest',
  'AppFault',
  'RigCheckAssignment',
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
    async changePassword({ current_password, new_password }) {
      return request('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password, new_password }),
      });
    },
    async logout(redirectUrl) {
      request('/api/auth/logout', { method: 'POST' }).catch(() => {});
      setToken(null);
      if (redirectUrl !== false) {
        window.location.href = typeof redirectUrl === 'string' ? redirectUrl : '/login';
      }
    },
    redirectToLogin() {
      window.location.href = '/login';
    },
    getToken,
    setToken,
  },
  users: {
    inviteUser(email, role = 'user', full_name = '') {
      return request('/api/users/invite', {
        method: 'POST',
        body: JSON.stringify({ email, role, full_name }),
      });
    },
    resetPassword({ email, allowCreate = false, full_name = '', role = 'user', inactive = false } = {}) {
      return request('/api/users/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, allowCreate, full_name, role, inactive }),
      });
    },
    resetPasswords({ emails, includeSelf = false, allowCreate = false, createFrom } = {}) {
      return request('/api/users/reset-passwords', {
        method: 'POST',
        body: JSON.stringify({ emails, includeSelf, allowCreate, createFrom }),
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
    saveSettings({ calendarId, dataCalendarId, fancamCalendarId }) {
      return request('/api/google/settings', {
        method: 'PATCH',
        body: JSON.stringify({ calendarId, dataCalendarId, fancamCalendarId }),
      });
    },
    saveOAuth({ clientId, clientSecret, redirectUri }) {
      return request('/api/google/oauth', {
        method: 'PATCH',
        body: JSON.stringify({ clientId, clientSecret, redirectUri }),
      });
    },
    sync() {
      return request('/api/google/sync', { method: 'POST' });
    },
  },
  slack: {
    status() {
      return request('/api/slack/status');
    },
    saveSettings({ botToken, channelId, enabled } = {}) {
      return request('/api/slack/settings', {
        method: 'PATCH',
        body: JSON.stringify({ botToken, channelId, enabled }),
      });
    },
    preview({ text } = {}) {
      return request('/api/slack/preview', {
        method: 'POST',
        body: JSON.stringify({ text: text || '' }),
      });
    },
    sync({ text } = {}) {
      return request('/api/slack/sync', {
        method: 'POST',
        body: JSON.stringify({ text: text || '' }),
      });
    },
    rigCheckStatus() {
      return request('/api/slack/rig-check');
    },
    saveRigCheckSettings({ channelId, teamId, openUrl, delivery } = {}) {
      return request('/api/slack/rig-check', {
        method: 'PATCH',
        body: JSON.stringify({ channelId, teamId, openUrl, delivery }),
      });
    },
    postRigCheck({ text } = {}) {
      return request('/api/slack/rig-check', {
        method: 'POST',
        body: JSON.stringify({ text: text || '' }),
      });
    },
  },
  dataImport: {
    entities({ files, confirm = false, entityType = '' }) {
      const form = new FormData();
      for (const file of files) form.append('files', file);
      form.append('confirm', String(confirm));
      if (entityType) form.append('entityType', entityType);
      return request('/api/import/entities', { method: 'POST', body: form });
    },
  },
  push: {
    vapidPublicKey() {
      return request('/api/push/vapid-public-key');
    },
    subscribe(subscription) {
      return request('/api/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({ subscription }),
      });
    },
    unsubscribe(endpoint) {
      return request('/api/push/unsubscribe', {
        method: 'POST',
        body: JSON.stringify({ endpoint }),
      });
    },
    test() {
      return request('/api/push/test', { method: 'POST' });
    },
  },
};

// Compatibility export used across existing UI files
export const base44 = api;
export { getToken, setToken, ApiError };
