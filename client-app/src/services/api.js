import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// ─── Base URL ────────────────────────────────────────────────────────────────
// Set EXPO_PUBLIC_API_URL in your .env or app.json extra.
// Falls back to localhost for Android emulator (10.0.2.2) / iOS simulator.
export const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:8000/api';

// ─── Axios instance (JSON only) ─────────────────────────────────────────────
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

// ─── Token helpers ───────────────────────────────────────────────────────────
const TOKEN_KEY = 'civixai_access';
const REFRESH_KEY = 'civixai_refresh'; 

export const tokenStorage = {
  getAccess:      () => SecureStore.getItemAsync(TOKEN_KEY),
  getRefresh:     () => SecureStore.getItemAsync(REFRESH_KEY),
  setAccess:  (t) => SecureStore.setItemAsync(TOKEN_KEY, t),
  setRefresh: (t) => SecureStore.setItemAsync(REFRESH_KEY, t),
  clear:      ()  => Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
  ]),
};

// ─── Request interceptor — attach Bearer token + JSON Content-Type ───────────
api.interceptors.request.use(async (config) => {
  const token = await tokenStorage.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (!config.headers['Content-Type']) {
    config.headers['Content-Type'] = 'application/json';
  }
  return config;
});

// ─── Response interceptor — refresh on 401 ──────────────────────────────────
let _refreshing = false;
let _queue = [];

const processQueue = (error, token = null) => {
  _queue.forEach(({ resolve, reject }) => error ? reject(error) : resolve(token));
  _queue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      if (_refreshing) {
        return new Promise((resolve, reject) => {
          _queue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }
      original._retry = true;
      _refreshing = true;
      try {
        const refresh = await tokenStorage.getRefresh();
        if (!refresh) throw new Error('No refresh token');
        const { data } = await axios.post(`${BASE_URL}/auth/token/refresh/`, { refresh });
        await tokenStorage.setAccess(data.access);
        processQueue(null, data.access);
        original.headers.Authorization = `Bearer ${data.access}`;
        return api(original);
      } catch (err) {
        processQueue(err);
        await tokenStorage.clear();
        return Promise.reject(err);
      } finally {
        _refreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

// ─── Native fetch for FormData (multipart) uploads ──────────────────────────
// Axios corrupts React Native FormData. Use native fetch for all file uploads.
async function multipartFetch(path, options = {}) {
  const token = await tokenStorage.getAccess();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // Do NOT set Content-Type — React Native fetch adds the multipart boundary.

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  if (res.status === 401) {
    // Attempt token refresh and retry once
    try {
      const refresh = await tokenStorage.getRefresh();
      if (!refresh) throw new Error('No refresh token');
      const refreshRes = await fetch(`${BASE_URL}/auth/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      });
      const refreshData = await refreshRes.json();
      await tokenStorage.setAccess(refreshData.access);
      headers['Authorization'] = `Bearer ${refreshData.access}`;
      const retryRes = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: { ...headers, ...options.headers },
      });
      if (!retryRes.ok) {
        const err = new Error(`HTTP ${retryRes.status}`);
        err.response = { status: retryRes.status, data: await retryRes.json().catch(() => null) };
        throw err;
      }
      return { data: await retryRes.json(), status: retryRes.status };
    } catch (err) {
      await tokenStorage.clear();
      throw err;
    }
  }

  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.response = { status: res.status, data: await res.json().catch(() => null) };
    throw err;
  }
  return { data: await res.json(), status: res.status };
}

// ─── Auth endpoints ──────────────────────────────────────────────────────────
export const authAPI = {
  login:          (email, password) => api.post('/auth/login/', { email, password }),
  register:       (data)            => api.post('/auth/register/', data),
  me:             ()                => api.get('/auth/me/'),
  refresh:        (token)           => api.post('/auth/token/refresh/', { refresh: token }),
  changePassword: (current_password, new_password) =>
    api.post('/auth/change-password/', { current_password, new_password }),
  uploadProfilePhoto: (formData) =>
    multipartFetch('/auth/profile-photo/', {
      method: 'POST',
      body: formData,
    }),
  updateProfile: (data) => api.patch('/auth/profile/', data),
};

// ─── Issues endpoints ────────────────────────────────────────────────────────
export const issuesAPI = {
  list:          (params)      => api.get('/issues/', { params }),
  myIssues:      ()            => api.get('/issues/my/'),
  assignedTasks: ()            => api.get('/issues/assigned/'),
  detail:        (id)          => api.get(`/issues/${id}/`),
  create:        (formData)    => multipartFetch('/issues/', {
    method: 'POST',
    body: formData,
  }),
  patch:         (id, formData) => multipartFetch(`/issues/${id}/`, {
    method: 'PATCH',
    body: formData,
  }),
  upvote:        (id)          => api.post(`/issues/${id}/upvote/`),
  addComment:    (id, text)    => api.post(`/issues/${id}/comments/`, { text }),
  nearby:        (params)      => api.get('/issues/nearby/', { params }),
};

// ─── AI endpoints ────────────────────────────────────────────────────────────
export const aiAPI = {
  detectIssue: (formData) => multipartFetch('/ai/detect-issue/', {
    method: 'POST',
    body: formData,
  }),
  verifyCompletion: (issueId) => api.post(`/ai/verify-completion/${issueId}/`),
  previewCompletion: (issueId, photoUri) => {
    const formData = new FormData();
    const filename = photoUri.split('/').pop() || 'completion.jpg';
    const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    formData.append('completion_photo', { uri: photoUri, name: filename, type: mime });
    return multipartFetch(`/ai/preview-completion/${issueId}/`, {
      method: 'POST',
      body: formData,
    });
  },
};

// ─── Agent endpoints ────────────────────────────────────────────────────────
export const agentAPI = {
  process: (issueId)  => api.post(`/agent/process-complaint/${issueId}/`),
  trace:   (issueId)  => api.get(`/agent/trace/${issueId}/`),
  status:  (issueId)  => api.get(`/agent/status/${issueId}/`),
  monitor: ()         => api.get('/agent/monitor/'),
};

// ─── Analytics endpoints ─────────────────────────────────────────────────────
export const analyticsAPI = {
  dashboardStats:  () => api.get('/analytics/dashboard-stats/'),
  wards:           () => api.get('/analytics/wards/'),
  categoryTrend:   () => api.get('/analytics/category-trend/'),
  resolutionTrend: () => api.get('/analytics/resolution-trend/'),
  activityLog:     () => api.get('/analytics/activity-log/'),
};

// ─── Bins endpoints ─────────────────────────────────────────────────────────
export const binsAPI = {
  list:   (params) => api.get('/bins/', { params }),
  detail: (id)     => api.get(`/bins/${id}/`),
  update: (id, data) => api.patch(`/bins/${id}/`, data),
};

export default api;
