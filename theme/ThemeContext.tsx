import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

export type Colors = {
  bg: string; card: string; border: string; text: string; textMuted: string;
  primary: string; accent: string; tabBar: string; inputBg: string; chip: string;
  subtle: string; badgeBg: string; danger: string; dangerBg: string;
  success: string; successBg: string; overlay: string;
};

const dark: Colors = {
  bg: '#0B0F19', card: '#161C2A', border: '#262E40', text: '#FFFFFF', textMuted: '#8A93A6',
  primary: '#7C3AED', accent: '#9061F9', tabBar: '#0D1220', inputBg: '#161C2A', chip: '#1E2536',
  subtle: '#1D2333', badgeBg: '#0B0F19', danger: '#F87171', dangerBg: '#2A1620',
  success: '#4ADE80', successBg: '#0B2A1A', overlay: 'rgba(0,0,0,0.6)',
};

const light: Colors = {
  bg: '#F5F6FA', card: '#FFFFFF', border: '#E2E5EC', text: '#111827', textMuted: '#6B7280',
  primary: '#7C3AED', accent: '#7C3AED', tabBar: '#FFFFFF', inputBg: '#FFFFFF', chip: '#EFEAFE',
  subtle: '#EEF0F5', badgeBg: '#FFFFFF', danger: '#DC2626', dangerBg: '#FEE2E2',
  success: '#16A34A', successBg: '#DCFCE7', overlay: 'rgba(0,0,0,0.4)',
};

export type Mode = 'system' | 'light' | 'dark';
const KEY = 'sportmatch_theme_mode';

type ThemeValue = { colors: Colors; isDark: boolean; mode: Mode; setMode: (m: Mode) => void };
const ThemeContext = createContext<ThemeValue>({ colors: dark, isDark: true, mode: 'system', setMode: () => {} });

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<Mode>('system');

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') setModeState(v);
    });
  }, []);

  function setMode(m: Mode) {
    setModeState(m);
    AsyncStorage.setItem(KEY, m);
  }

  const isDark = mode === 'system' ? system !== 'light' : mode === 'dark';
  const value = useMemo(() => ({ colors: isDark ? dark : light, isDark, mode, setMode }), [isDark, mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useAppTheme = () => useContext(ThemeContext);