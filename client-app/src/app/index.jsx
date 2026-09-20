import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, BackHandler } from 'react-native';
import { ClientProvider, useClient } from '../context/ClientContext';
import { Home, FileText, Radio, User, Map } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Login from '../pages/Login';
import Register from '../pages/Register';
import CitizenHome from '../pages/CitizenHome';
import CitizenProfile from '../pages/CitizenProfile';
import ReportIssue from '../pages/ReportIssue';
import IssueSubmitSuccess from '../pages/IssueSubmitSuccess';
import MyComplaints from '../pages/MyComplaints';
import ComplaintDetail from '../pages/ComplaintDetail';
import CivicFeed from '../pages/CivicFeed';
import WorkerDashboard from '../pages/WorkerDashboard';
import TaskDetail from '../pages/TaskDetail';
import WorkerFeed from '../pages/WorkerFeed';
import WorkerMap from '../pages/WorkerMap';
import WorkerProfile from '../pages/WorkerProfile';

// ── Citizen bottom nav (4 tabs, always shown on tab pages) ──
function CitizenBottomNav({ active, onHome, onComplaints, onFeed, onProfile }) {
  const insets = useSafeAreaInsets();
  const tabs = [
    { id: 'home',       label: 'Home',      Icon: Home,     action: onHome       },
    { id: 'complaints', label: 'My Issues', Icon: FileText, action: onComplaints },
    { id: 'feed',       label: 'Feed',      Icon: Radio,    action: onFeed       },
    { id: 'profile',    label: 'Profile',   Icon: User,     action: onProfile    },
  ];
  return (
    <View style={[styles.bottomNav, { paddingBottom: insets.bottom || 8 }]}>
      {tabs.map(({ id, label, Icon, action }) => (
        <TouchableOpacity key={id} style={styles.navTab} onPress={action} activeOpacity={0.7}>
          <Icon size={20} color={active === id ? '#2563eb' : '#9ca3af'} />
          <Text style={[styles.navLabel, active === id ? styles.navLabelActive : styles.navLabelInactive]}>
            {label}
          </Text>
          {active === id && <View style={styles.navDot} />}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Worker bottom nav (lives in index so it's always visible even on sub-pages) ──
function WorkerBottomNav({ active, onHome, onFeed, onMap, onProfile }) {
  const insets = useSafeAreaInsets();
  const tabs = [
    { id: 'home',    label: 'Home',    Icon: Home,     action: onHome    },
    { id: 'feed',    label: 'Feed',    Icon: Radio,    action: onFeed    },
    { id: 'map',     label: 'Map',     Icon: Map,      action: onMap },
    { id: 'profile', label: 'Profile', Icon: User,     action: onProfile },
  ];
  return (
    <View style={[styles.bottomNav, { paddingBottom: insets.bottom || 8 }]}>
      {tabs.map(({ id, label, Icon, action }) => (
        <TouchableOpacity key={id} style={styles.navTab} onPress={action} activeOpacity={0.7}>
          <Icon size={20} color={active === id ? '#2563eb' : '#9ca3af'} />
          <Text style={[styles.navLabel, active === id ? styles.navLabelActive : styles.navLabelInactive]}>
            {label}
          </Text>
          {active === id && <View style={styles.navDot} />}
        </TouchableOpacity>
      ))}
    </View>
  );
}

function AppContent() {
  const { user, logout, authReady } = useClient();
  const [page, setPage] = useState('login');
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [selectedTask, setSelectedTask]           = useState(null);
  const [lastSubmittedId, setLastSubmittedId]     = useState(null);
  const [activeTab, setActiveTab]                 = useState('home');
  const [workerTab, setWorkerTab]                 = useState('home');

  // Redirect to the correct home page after login, and reset page on logout
  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      // User logged out — reset everything back to login
      setPage('login');
      setSelectedComplaint(null);
      setSelectedTask(null);
      setLastSubmittedId(null);
      setActiveTab('home');
      setWorkerTab('home');
      return;
    }
    // User just logged in
    if (user.type === 'citizen') { setPage('home'); setActiveTab('home'); }
    else { setPage('workerDash'); setWorkerTab('home'); }
  }, [user?.id, authReady]);

  // Android hardware back button
  useEffect(() => {
    const backMap = {
      // Citizen
      report:       () => { setPage('home'); setActiveTab('home'); return true; },
      success:      () => { setPage('home'); setActiveTab('home'); return true; },
      detail:       () => { setPage('myComplaints'); setActiveTab('complaints'); return true; },
      myComplaints: () => { setPage('home'); setActiveTab('home'); return true; },
      feed:         () => { setPage('home'); setActiveTab('home'); return true; },
      profile:      () => { setPage('home'); setActiveTab('home'); return true; },
      home:         () => { BackHandler.exitApp(); return true; },
      // Worker
      taskDetail:   () => { setPage('workerDash'); setWorkerTab('home'); return true; },
      workerFeed:   () => { setPage('workerDash'); setWorkerTab('home'); return true; },
      workerMap:    () => { setPage('workerDash'); setWorkerTab('home'); return true; },
      workerProfile:() => { setPage('workerDash'); setWorkerTab('home'); return true; },
      workerDash:   () => { BackHandler.exitApp(); return true; },
    };

    const handler = () => {
      const action = backMap[page];
      return action ? action() : false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', handler);
    return () => sub.remove();
  }, [page]);

  // Show splash while restoring session from SecureStore
  if (!authReady) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.splashText}>CivixAI</Text>
      </View>
    );
  }

  if (!user) {
    if (page === 'register') return <Register onBack={() => setPage('login')} />;
    return <Login onRegister={() => setPage('register')} />;
  }

  const handleLogout = async () => {
    await logout();
    // page will be reset to 'login' by the useEffect above when user becomes null
  };

  // ── Worker flow ──
  if (user.type === 'worker') {
    const goWorkerHome    = () => { setPage('workerDash');    setWorkerTab('home');    };
    const goWorkerFeed    = () => { setPage('workerFeed');    setWorkerTab('feed');    };
    const goWorkerMap     = () => { setPage('workerMap');     setWorkerTab('map');     };
    const goWorkerProfile = () => { setPage('workerProfile'); setWorkerTab('profile'); };

    const showWorkerNav = !['taskDetail'].includes(page);

    const workerPage = (() => {
      if (page === 'taskDetail' && selectedTask)
        return <TaskDetail task={selectedTask} onBack={goWorkerHome} />;
      if (page === 'workerFeed')
        return <WorkerFeed />;
      if (page === 'workerMap')
        return <WorkerMap />;
      if (page === 'workerProfile')
        return <WorkerProfile onLogout={handleLogout} />;
      return (
        <WorkerDashboard
          onTaskDetail={(task) => { setSelectedTask(task); setPage('taskDetail'); }}
          onLogout={handleLogout}
          onProfile={goWorkerProfile}
        />
      );
    })();

    return (
      <View style={styles.root}>
        <View style={styles.pageContainer}>{workerPage}</View>
        {showWorkerNav && (
          <WorkerBottomNav
            active={workerTab}
            onHome={goWorkerHome}
            onFeed={goWorkerFeed}
            onMap={goWorkerMap}
            onProfile={goWorkerProfile}
          />
        )}
      </View>
    );
  }

  // ── Citizen flow ──
  const goHome       = () => { setPage('home');         setActiveTab('home');       };
  const goComplaints = () => { setPage('myComplaints'); setActiveTab('complaints'); };
  const goFeed       = () => { setPage('feed');          setActiveTab('feed');       };
  const goProfile    = () => { setPage('profile');       setActiveTab('profile');    };

  const showBottomNav = ['home', 'myComplaints', 'feed', 'profile'].includes(page);

  return (
    <View style={styles.root}>
      <View style={styles.pageContainer}>
        {page === 'home' && (
          <CitizenHome
            onReport={() => setPage('report')}
            onMyComplaints={goComplaints}
            onFeed={goFeed}
            onProfile={goProfile}
            onLogout={handleLogout}
            onComplaintDetail={(c) => { setSelectedComplaint(c); setPage('detail'); }}
          />
        )}
        {page === 'report' && (
          <ReportIssue
            onBack={goHome}
            onSuccess={(id) => { setLastSubmittedId(id); setPage('success'); }}
          />
        )}
        {page === 'success' && (
          <IssueSubmitSuccess
            issueId={lastSubmittedId}
            onHome={goHome}
            onTrack={goComplaints}
          />
        )}
        {page === 'myComplaints' && (
          <MyComplaints
            onBack={goHome}
            onDetail={(c) => { setSelectedComplaint(c); setPage('detail'); }}
          />
        )}
        {page === 'detail' && selectedComplaint && (
          <ComplaintDetail
            complaint={selectedComplaint}
            onBack={() => { setPage('myComplaints'); setActiveTab('complaints'); }}
          />
        )}
        {page === 'feed' && (
          <CivicFeed onBack={goHome} />
        )}
        {page === 'profile' && (
          <CitizenProfile onLogout={handleLogout} />
        )}
      </View>

      {showBottomNav && (
        <CitizenBottomNav
          active={activeTab}
          onHome={goHome}
          onComplaints={goComplaints}
          onFeed={goFeed}
          onProfile={goProfile}
        />
      )}
    </View>
  );
}

export default function App() {
  return (
    <ClientProvider>
      <AppContent />
    </ClientProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f1f5f9' },
  splash: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', gap: 16 },
  splashText: { fontSize: 22, fontWeight: '700', color: '#2563eb' },
  pageContainer: { flex: 1 },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  navTab: { flex: 1, alignItems: 'center', paddingTop: 10, paddingBottom: 4, gap: 3 },
  navLabel: { fontSize: 10, fontWeight: '600' },
  navLabelActive: { color: '#2563eb' },
  navLabelInactive: { color: '#9ca3af' },
  navDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#2563eb', marginTop: 1 },
});
