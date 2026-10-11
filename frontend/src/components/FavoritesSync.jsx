import { useEffect } from 'react';
import { useAuth } from '../context/auth-context';
import api from '../lib/api';
import useFavStore from '../store/favStore';

const same = (a, b) => a.length === b.length && a.every((id) => b.includes(id));

/**
 * Keeps favourites on the account while signed in: on sign-in the browser's
 * list is merged with the saved one, and later changes are saved back.
 */
export default function FavoritesSync() {
  const { user } = useAuth();
  const userId = user?.id;
  const saved = user?.favorites;

  useEffect(() => {
    if (!userId) return undefined;
    const fromAccount = Array.isArray(saved) ? saved : [];
    const local = useFavStore.getState().ids;
    const merged = [...new Set([...fromAccount, ...local])];
    if (!same(merged, local)) useFavStore.setState({ ids: merged });

    let last = fromAccount;
    let timer;
    const push = (ids) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (same(ids, last)) return;
        last = ids;
        api.put('/api/me/favorites', { ids }).catch(() => {});
      }, 500);
    };
    push(merged);
    const unsubscribe = useFavStore.subscribe((state) => push(state.ids));
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
    // Only re-sync when a different user signs in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return null;
}
