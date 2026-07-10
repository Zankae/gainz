import { useState, useEffect } from 'react';
import { ThemeProvider } from './theme';
import WorkoutScreen from './components/WorkoutScreen';
import HomeScreen from './components/HomeScreen';
import HistoryScreen from './components/HistoryScreen';
import ProgressScreen from './components/ProgressScreen';
import ProfileScreen from './components/ProfileScreen';

type Tab = 'home' | 'workout' | 'history' | 'progress' | 'profile';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'workout', label: 'Workout', icon: 'workout' },
  { key: 'history', label: 'History', icon: 'history' },
  { key: 'progress', label: 'Progress', icon: 'progress' },
  { key: 'profile', label: 'Profile', icon: 'profile' },
];

function NavIcon({ name, active }: { name: string; active: boolean }) {
  const color = active ? 'var(--accent)' : 'var(--muted)';
  switch (name) {
    case 'home':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
    case 'workout':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6.5 6.5l11 11" />
          <path d="M21 21l-1-1" />
          <path d="M3 3l1 1" />
          <path d="m18 22 4-4" />
          <path d="m2 6 4-4" />
          <path d="M3 10l1-1" />
          <path d="m14.5 3.5-1 1" />
          <path d="m9.5 20.5 1-1" />
          <path d="M21 14l-1 1" />
          <path d="M10 3 8 5" />
          <path d="m20.5 9.5 1-1" />
          <path d="m3.5 14.5-1 1" />
        </svg>
      );
    case 'history':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case 'progress':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      );
    case 'profile':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    default:
      return null;
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);

  return (
    <ThemeProvider>
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1 }}>
          {tab === 'home' && <HomeScreen onNavigate={setTab} />}
          {tab === 'workout' && <WorkoutScreen />}
          {tab === 'history' && <HistoryScreen onNavigate={setTab} />}
          {tab === 'progress' && <ProgressScreen />}
          {tab === 'profile' && <ProfileScreen />}
        </div>

        <nav style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 480,
          height: 'var(--nav-h)',
          display: 'flex',
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          zIndex: 100,
        }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                color: tab === t.key ? 'var(--accent)' : 'var(--muted)',
              }}
            >
              <NavIcon name={t.icon} active={tab === t.key} />
              <span style={{ fontSize: 10, fontWeight: 500 }}>{t.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </ThemeProvider>
  );
}
