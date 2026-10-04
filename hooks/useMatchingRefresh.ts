import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { AppState } from 'react-native';
import { cargarMatching } from '../services/matchStore';

/** Refresh only while this screen is focused and the application is active. */
export function useMatchingRefresh() {
  useFocusEffect(useCallback(() => {
    const refresh = () => { if (AppState.currentState === 'active') void cargarMatching(); };
    refresh();
    const timer = setInterval(refresh, 5000);
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    return () => { clearInterval(timer); listener.remove(); };
  }, []));
}
