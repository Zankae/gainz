import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'dark' | 'light';
export type Preference = Theme | 'system';

interface ThemeCtx {
  theme: Theme;
  preference: Preference;
  setPreference: (p: Preference) => void;
}

const ThemeContext = createContext<ThemeCtx>({
  theme: 'dark',
  preference: 'system',
  setPreference: () => {},
});

function resolveTheme(pref: Preference): Theme {
  if (pref === 'dark' || pref === 'light') return pref;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<Preference>(() => {
    const stored = localStorage.getItem('gainz-theme');
    return stored === 'dark' || stored === 'light' || stored === 'system' ? stored : 'system';
  });

  const [theme, setTheme] = useState<Theme>(() => resolveTheme(preference));

  const setPreference = (p: Preference) => {
    setPreferenceState(p);
    localStorage.setItem('gainz-theme', p);
  };

  useEffect(() => {
    const resolved = resolveTheme(preference);
    setTheme(resolved);
    document.documentElement.dataset.theme = resolved;
  }, [preference]);

  useEffect(() => {
    if (preference !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const resolved = mq.matches ? 'dark' : 'light';
      setTheme(resolved);
      document.documentElement.dataset.theme = resolved;
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [preference]);

  return (
    <ThemeContext.Provider value={{ theme, preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
