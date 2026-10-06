import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Activity, listActivities } from '../services/activities';
import { ApiError } from '../services/api';

export function useActivities(limit = 20) {
  const [items, setItems] = useState<Activity[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const generation = useRef(0);
  const busy = useRef(false);

  const load = useCallback(async (after?: string) => {
    if (after && busy.current) return;
    const current = ++generation.current;
    busy.current = true;
    setLoading(true); setError(null); setSessionExpired(false);
    if (!after) { setItems([]); setCursor(null); }
    try {
      const page = await listActivities(limit, after);
      if (generation.current !== current) return;
      setItems((previous) => after ? [...previous, ...page.items.filter((item) => !previous.some((p) => p.id === item.id))] : page.items);
      setCursor(page.next_cursor);
    } catch (e) {
      if (generation.current !== current) return;
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las actividades.');
      if (e instanceof ApiError && e.status === 401) { setSessionExpired(true); setItems([]); setCursor(null); }
    } finally {
      if (generation.current === current) { busy.current = false; setLoading(false); }
    }
  }, [limit]);

  useFocusEffect(useCallback(() => {
    void load();
    return () => { generation.current++; busy.current = false; };
  }, [load]));
  return { items, loading, error, sessionExpired, cursor,
    refresh: () => load(), more: () => cursor ? load(cursor) : Promise.resolve() };
}
