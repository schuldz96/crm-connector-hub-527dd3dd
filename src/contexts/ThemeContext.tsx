import { createContext, useContext, useState, useEffect } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';
type AccentColor = 'indigo' | 'blue' | 'green' | 'red' | 'orange' | 'pink' | 'violet';

interface ThemeContextType {
  mode: ThemeMode;
  accent: AccentColor;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentColor) => void;
  isDark: boolean;
}

const STORAGE_KEY = 'ltx_theme';

const ACCENT_COLORS: Record<AccentColor, string> = {
  indigo: '234 89% 74%',
  blue: '217 91% 60%',
  green: '142 76% 36%',
  red: '0 84% 60%',
  orange: '25 95% 53%',
  pink: '330 81% 60%',
  violet: '263 70% 50%',
};

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark', accent: 'indigo', setMode: () => {}, setAccent: () => {}, isDark: true,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    try { return (JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').mode as ThemeMode) || 'dark'; } catch { return 'dark'; }
  });
  const [accent, setAccentState] = useState<AccentColor>(() => {
    try { return (JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').accent as AccentColor) || 'indigo'; } catch { return 'indigo'; }
  });

  const systemDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = mode === 'dark' || (mode === 'system' && systemDark);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', isDark);
    root.style.setProperty('--primary', ACCENT_COLORS[accent]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, accent }));
  }, [mode, accent, isDark]);

  const setMode = (m: ThemeMode) => setModeState(m);
  const setAccent = (a: AccentColor) => setAccentState(a);

  return (
    <ThemeContext.Provider value={{ mode, accent, setMode, setAccent, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() { return useContext(ThemeContext); }
export { ACCENT_COLORS };
export type { ThemeMode, AccentColor };
