import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI, issuesAPI, aiAPI, agentAPI, tokenStorage, BASE_URL } from '../services/api';

const ClientContext = createContext();

// ─── URL rewriter ─────────────────────────────────────────────────────────────
// The backend builds image URLs using request.build_absolute_uri(), which embeds
// whatever IP Django sees. If that differs from BASE_URL (e.g. different network
// interface or hotspot), images silently fail. Rewrite every media URL so its
// origin always matches the origin the app is actually talking to.
const _serverOrigin = (() => {
  try {
    // BASE_URL is e.g. "http://192.168.65.141:8000/api" → origin = "http://192.168.65.141:8000"
    const url = new URL(BASE_URL);
    return url.origin; // "http://192.168.65.141:8000"
  } catch {
    return null;
  }
})();

const rewriteMediaUrl = (url) => {
  if (!url || !_serverOrigin) return url;
  try {
    const parsed = new URL(url);
    // Replace scheme+host+port with the origin the app is configured to use
    return _serverOrigin + parsed.pathname + parsed.search;
  } catch {
    return url;
  }
};

// ─── Shape helpers ────────────────────────────────────────────────────────────
// Normalise a backend issue object to the shape the UI expects.
const normaliseIssue = (issue) => ({
  id:              issue.display_id,          // UI uses "CP-XXXX" strings as IDs
  _id:             issue.id,                  // numeric DB id needed for API calls
  title:           issue.title,
  description:     issue.description,
  category:        issue.category,
  status:          issue.status,
  priority:        issue.priority,
  priorityScore:   issue.priority_score,
  ward:            issue.ward,
  location:        issue.location_text || '',
  lat:             issue.location_lat,
  lng:             issue.location_lng,
  isPublic:        issue.is_public,
  upvotes:         issue.upvotes,
  upvotedByMe:     issue.upvoted_by_me,
  image:           rewriteMediaUrl(issue.image_url),
  completionPhoto: rewriteMediaUrl(issue.completion_photo_url),
  aiScore:         issue.ai_completion_score,
  aiVerdict:       issue.ai_completion_verdict,
  reportedBy:      issue.reported_by,
  reporterName:    issue.reported_by_detail?.name || '',
  reporterPhoto:   rewriteMediaUrl(issue.reported_by_detail?.profile_photo_url || null),
  assignedTo:      issue.assigned_to_detail?.id || null,
  assignedToName:  issue.assigned_to_detail?.name || null,
  reportedAt:      issue.reported_at,
  assignedAt:      issue.assigned_at,
  resolvedAt:      issue.resolved_at,
  comments:        (issue.comments || []).map(c => ({
    id:   c.id,
    user: c.user_name,
    text: c.text,
    time: c.created_at,
  })),
  timeline:        (issue.timeline || []).map(t => ({
    status: t.status,
    note:   t.note,
    time:   t.changed_at,
  })),
});

// Normalise backend user → UI user shape
const normaliseUser = (data, tokens) => ({
  type:         data.role,              // 'citizen' | 'worker' | 'admin'
  id:           data.id,
  displayId:    data.display_id,
  name:         data.full_name || `${data.first_name || ''} ${data.last_name || ''}`.trim() || data.email,
  firstName:    data.first_name || '',
  lastName:     data.last_name  || '',
  email:        data.email,
  phone:        data.phone || '',
  ward:         data.ward || '',
  category:     data.category || '',
  joinedDate:   data.joined_date,
  profilePhoto: rewriteMediaUrl(data.profile_photo_url || null),
  gender:       data.gender   || '',
  dob:          data.dob      || '',   // 'YYYY-MM-DD' or ''
  street:       data.street   || '',
  landmark:     data.landmark || '',
  access:       tokens?.access,
  refresh:      tokens?.refresh,
});

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ClientProvider({ children }) {
  const [user,       setUser]       = useState(null);
  const [authReady,  setAuthReady]  = useState(false); // true once token check is done
  const [complaints, setComplaints] = useState([]);
  const [myTasks,    setMyTasks]    = useState([]);
  const [loading,    setLoading]    = useState(false);

  // ── On app start: restore session from SecureStore ──────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const access = await tokenStorage.getAccess();
        if (access) {
          const { data } = await authAPI.me();
          setUser(normaliseUser(data));
        }
      } catch {
        await tokenStorage.clear();
      } finally {
        setAuthReady(true);
      }
    })();
  }, []);

  // ── Login ────────────────────────────────────────────────────────────────────
  const login = async (email, password /*, role param kept for UI compat */) => {
    try {
      const { data } = await authAPI.login(email, password);
      await tokenStorage.setAccess(data.access);
      await tokenStorage.setRefresh(data.refresh);
      // Fetch full profile
      const { data: me } = await authAPI.me();
      setUser(normaliseUser(me, data));
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.detail || 'Invalid credentials.';
      return { success: false, error: msg };
    }
  };

  // ── Register ─────────────────────────────────────────────────────────────────
  const register = async ({ name, email, phone, ward, password }) => {
    try {
      await authAPI.register({
        name,
        email,
        phone,
        ward,
        password,
        role: 'citizen',
      });
      return { success: true };
    } catch (err) {
      const data = err.response?.data;
      const msg  = data
        ? Object.values(data).flat().join(' ')
        : 'Registration failed. Please try again.';
      return { success: false, error: msg };
    }
  };

  // ── Logout ───────────────────────────────────────────────────────────────────
  const logout = async () => {
    await tokenStorage.clear();
    setUser(null);
    setComplaints([]);
    setMyTasks([]);
  };

  // ── Upload profile photo ──────────────────────────────────────────────────────
  const uploadProfilePhoto = async (uri) => {
    const filename = uri.split('/').pop();
    const match    = /\.(\w+)$/.exec(filename);
    const type     = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';

    const form = new FormData();
    form.append('photo', { uri, name: filename, type });

    const { data } = await authAPI.uploadProfilePhoto(form);
    setUser(prev => ({ ...prev, profilePhoto: data.profile_photo_url || null }));
    return data.profile_photo_url || null;
  };

  // ── Update profile fields ─────────────────────────────────────────────────────
  const updateProfile = async (fields) => {
    // fields: { first_name, last_name, ward, gender, dob, street, landmark }
    const { data } = await authAPI.updateProfile(fields);
    setUser(prev => normaliseUser(data, { access: prev?.access, refresh: prev?.refresh }));
    return data;
  };

  // ── Fetch citizen's own issues ────────────────────────────────────────────────
  const fetchMyComplaints = useCallback(async () => {
    try {
      const { data } = await issuesAPI.myIssues();
      setComplaints(data.map(normaliseIssue));
    } catch (err) {
      console.warn('fetchMyComplaints failed:', err.message);
    }
  }, []);

  // ── Fetch worker's assigned tasks ─────────────────────────────────────────────
  const fetchMyTasks = useCallback(async () => {
    try {
      const { data } = await issuesAPI.assignedTasks();
      setMyTasks(data.map(normaliseIssue));
    } catch (err) {
      console.warn('fetchMyTasks failed:', err.message);
    }
  }, []);

  // Auto-load data when user logs in
  useEffect(() => {
    if (!user) return;
    if (user.type === 'citizen') fetchMyComplaints();
    if (user.type === 'worker')  fetchMyTasks();
  }, [user?.id]);

  // ── Submit new complaint ──────────────────────────────────────────────────────
  const submitComplaint = async (data) => {
    const form = new FormData();
    form.append('title',       data.title);
    form.append('description', data.description || '');
    form.append('category',    data.category);
    form.append('ward',        data.ward || user?.ward || '');
    form.append('location_text', data.location || '');
    if (data.lat) form.append('location_lat', String(data.lat));
    if (data.lng) form.append('location_lng', String(data.lng));
    form.append('is_public', data.isPublic !== false ? 'true' : 'false');

    if (data.image) {
      const uri      = data.image;
      const filename = uri.split('/').pop();
      const match    = /\.(\w+)$/.exec(filename);
      const type     = match ? `image/${match[1]}` : 'image/jpeg';
      form.append('image', { uri, name: filename, type });
    }

    try {
      const { data: created } = await issuesAPI.create(form);
      const normalised = normaliseIssue(created);
      setComplaints(prev => [normalised, ...prev]);
      return normalised.id; // returns display_id like "CP-XXXX"
    } catch (err) {
      console.warn('submitComplaint failed:', err.response?.data || err.message);
      throw err;
    }
  };

  // ── Add comment ───────────────────────────────────────────────────────────────
  const addComment = async (complaintDisplayId, text) => {
    // Find numeric _id from local state
    const issue = complaints.find(c => c.id === complaintDisplayId)
                || myTasks.find(c => c.id === complaintDisplayId);
    if (!issue) return;
    try {
      await issuesAPI.addComment(issue._id, text);
      // Optimistic update
      const newComment = { id: Date.now(), user: user?.name || 'You', text, time: new Date().toISOString() };
      const updater = prev => prev.map(c =>
        c.id === complaintDisplayId
          ? { ...c, comments: [...c.comments, newComment] }
          : c
      );
      setComplaints(updater);
      setMyTasks(updater);
    } catch (err) {
      console.warn('addComment failed:', err.message);
    }
  };

  // ── Upvote ────────────────────────────────────────────────────────────────────
  const upvoteComplaint = async (complaintDisplayId) => {
    const issue = complaints.find(c => c.id === complaintDisplayId);
    if (!issue) return;
    try {
      const { data } = await issuesAPI.upvote(issue._id);
      setComplaints(prev => prev.map(c =>
        c.id === complaintDisplayId
          ? { ...c, upvotes: data.upvotes, upvotedByMe: data.upvoted }
          : c
      ));
    } catch (err) {
      console.warn('upvoteComplaint failed:', err.message);
    }
  };

  // ── Worker: update task status + upload completion photo ──────────────────────
  const updateTaskStatus = async (taskDisplayId, newStatus, _proof, completionPhotoUri) => {
    const task = myTasks.find(t => t.id === taskDisplayId);
    if (!task) return;

    const form = new FormData();
    form.append('status', newStatus);

    if (completionPhotoUri) {
      const uri      = completionPhotoUri;
      const filename = uri.split('/').pop();
      const match    = /\.(\w+)$/.exec(filename);
      const type     = match ? `image/${match[1]}` : 'image/jpeg';
      form.append('completion_photo', { uri, name: filename, type });
    }

    try {
      const { data } = await issuesAPI.patch(task._id, form);
      const updated  = normaliseIssue(data);
      setMyTasks(prev => prev.map(t => t.id === taskDisplayId ? updated : t));
      setComplaints(prev => prev.map(c => c.id === taskDisplayId ? updated : c));
    } catch (err) {
      console.warn('updateTaskStatus failed:', err.response?.data || err.message);
      throw err;
    }
  };

  // ── Derived: citizen's complaints from local state ────────────────────────────
  const myComplaints = user?.type === 'citizen' ? complaints : [];

  return (
    <ClientContext.Provider value={{
      user,
      authReady,
      loading,
      login,
      register,
      logout,
      uploadProfilePhoto,
      updateProfile,
      complaints,
      myComplaints,
      myTasks,
      fetchMyComplaints,
      fetchMyTasks,
      submitComplaint,
      addComment,
      upvoteComplaint,
      updateTaskStatus,
    }}>
      {children}
    </ClientContext.Provider>
  );
}

export const useClient = () => useContext(ClientContext);
