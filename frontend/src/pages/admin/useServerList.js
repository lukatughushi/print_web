import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../lib/api';
import { getErrorMessage } from './adminShared';

/**
 * Loads one server-side page: GET `${path}?${params}` → { items, total, page, pageSize, … }.
 * Responses that arrive after a newer request are ignored, so fast typing in
 * the search box can't show stale results.
 */
export default function useServerList(path, params, errorText) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null && v !== false),
  ).toString();
  const key = `${path}?${query}`;

  const [tick, setTick] = useState(0);
  const [result, setResult] = useState({ key: null, tick: -1, data: null, error: '' });
  const seq = useRef(0);

  useEffect(() => {
    const mine = ++seq.current;
    api.get(key)
      .then((r) => { if (mine === seq.current) setResult({ key, tick, data: r.data, error: '' }); })
      .catch((e) => { if (mine === seq.current) setResult((prev) => ({ ...prev, key, tick, error: getErrorMessage(e, errorText) })); });
  }, [key, tick, errorText]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback((update) => setResult((prev) => ({
    ...prev,
    data: typeof update === 'function' ? update(prev.data) : update,
  })), []);

  return {
    data: result.data,
    setData,
    error: result.error,
    // Previous page stays visible (dimmed) while the next one loads.
    loading: result.key !== key || result.tick !== tick,
    reload,
  };
}

/** `value`, but only after it has stopped changing for `ms` (for search boxes). */
export function useDebounced(value, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** Page sizes offered under every admin list. */
export const PAGE_SIZES = [10, 20, 50];
const DEFAULT_SIZE = 20;

/** Page size for one list, remembered in this browser (per list `key`). */
export function usePageSize(key) {
  const storageKey = `admin:pageSize:${key}`;
  const [size, setSize] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(storageKey));
      return PAGE_SIZES.includes(saved) ? saved : DEFAULT_SIZE;
    } catch {
      return DEFAULT_SIZE;
    }
  });
  const update = useCallback((next) => {
    setSize(next);
    try { localStorage.setItem(storageKey, String(next)); } catch { /* not persisted */ }
  }, [storageKey]);
  return [size, update];
}
