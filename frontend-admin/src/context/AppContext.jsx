import { createContext, useContext, useState, useEffect } from 'react';
import {
  apiGetMe, apiGetAllIssues, apiGetWorkers, apiGetBins,
  apiUpdateIssue, apiUpdateBin,
  apiLogin as apiLoginCall, clearTokens, setTokens, getAccessToken,
} from '../services/api';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [user, setUser]           = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Shared data — loaded once by AppProvider so all pages can read them
  const [issues, setIssues]   = useState([]);
  const [workers, setWorkers] = useState([]);
  const [bins, setBins]       = useState([]);

  // Notifications — derived from real data after load
  const [notifications, setNotifications] = useState([]);

  // ── Session restore on mount ──────────────────────────────────────────────
  useEffect(() => {
    async function restore() {
      if (!getAccessToken()) { setAuthLoading(false); return; }
      try {
        const me = await apiGetMe();
        if (me.role !== 'admin') { clearTokens(); setAuthLoading(false); return; }
        setUser(me);
        await loadData();
      } catch {
        clearTokens();
      } finally {
        setAuthLoading(false);
      }
    }
    restore();
  }, []);

  // ── Load all shared data ──────────────────────────────────────────────────
  async function loadData() {
    try {
      const [issuesData, workersData, binsData] = await Promise.all([
        apiGetAllIssues(),
        apiGetWorkers(),
        apiGetBins(),
      ]);
      const issuesList = Array.isArray(issuesData) ? issuesData : (issuesData.results || []);
      setIssues(issuesList);
      setWorkers(Array.isArray(workersData) ? workersData : (workersData.results || []));
      setBins(Array.isArray(binsData) ? binsData : (binsData.results || []));

      // Build notifications from overflow bins + unassigned high-priority issues
      const notifs = [];
      const binsArr = Array.isArray(binsData) ? binsData : (binsData.results || []);
      binsArr.filter(b => b.fill_level >= 85).forEach(b => {
        notifs.push({ id: `bin-${b.id}`, text: `${b.display_id || b.id} overflow at ${b.location_text || b.location}`, type: 'alert', read: false });
      });
      issuesList.filter(i => i.priority === 'High' && !i.assigned_to).slice(0, 2).forEach(i => {
        notifs.push({ id: `issue-${i.id}`, text: `${i.display_id} high priority unassigned`, type: 'warning', read: false });
      });
      setNotifications(notifs);
    } catch (e) {
      console.error('loadData error', e);
    }
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  async function login(email, password) {
    const data = await apiLoginCall(email, password);
    if (data.user.role !== 'admin') throw new Error('Access denied: admin account required');
    setTokens(data.access, data.refresh);
    setUser(data.user);
    await loadData();
    return data.user;
  }

  function logout() {
    clearTokens();
    setUser(null);
    setIssues([]);
    setWorkers([]);
    setBins([]);
    setNotifications([]);
  }

  // ── Issue actions ─────────────────────────────────────────────────────────
  const updateIssueStatus = async (issueId, newStatus, assignedTo, note) => {
    try {
      const payload = { status: newStatus };
      if (note) payload.note = note;
      if (assignedTo !== undefined) payload.assigned_to = assignedTo;
      const updated = await apiUpdateIssue(issueId, payload);
      setIssues(prev => prev.map(i => i.id === issueId ? { ...i, ...updated } : i));
      return updated;
    } catch (e) {
      console.error('updateIssueStatus error', e);
      throw e;
    }
  };

  const assignWorker = async (issueId, workerId) => {
    try {
      const updated = await apiUpdateIssue(issueId, { assigned_to: workerId, status: 'Assigned' });
      setIssues(prev => prev.map(i => i.id === issueId ? { ...i, ...updated } : i));
      return updated;
    } catch (e) {
      console.error('assignWorker error', e);
      throw e;
    }
  };

  const refreshIssues = async () => {
    try {
      const data = await apiGetAllIssues();
      const list = Array.isArray(data) ? data : (data.results || []);
      setIssues(list);
    } catch (e) {
      console.error('refreshIssues error', e);
    }
  };

  // ── Bin actions ───────────────────────────────────────────────────────────
  const updateBinLevel = async (binId, fillLevel) => {
    try {
      const updated = await apiUpdateBin(binId, { fill_level: fillLevel });
      setBins(prev => prev.map(b => b.id === binId ? { ...b, ...updated } : b));
      return updated;
    } catch (e) {
      console.error('updateBinLevel error', e);
      throw e;
    }
  };

  const refreshBins = async () => {
    try {
      const data = await apiGetBins();
      setBins(Array.isArray(data) ? data : (data.results || []));
    } catch (e) {
      console.error('refreshBins error', e);
    }
  };

  // ── Worker actions ────────────────────────────────────────────────────────
  const refreshWorkers = async () => {
    try {
      const data = await apiGetWorkers();
      setWorkers(Array.isArray(data) ? data : (data.results || []));
    } catch (e) {
      console.error('refreshWorkers error', e);
    }
  };

  // ── Notifications ─────────────────────────────────────────────────────────
  const markNotificationRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <AppContext.Provider value={{
      user, authLoading, login, logout,
      issues, workers, bins, notifications, unreadCount,
      updateIssueStatus, assignWorker, refreshIssues,
      updateBinLevel, refreshBins,
      refreshWorkers,
      markNotificationRead,
      loadData,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
