import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Favourite product ids, kept per browser (no account needed).
const useFavStore = create(
  persist(
    (set) => ({
      ids: [],
      toggle: (id) => set((s) => ({ ids: s.ids.includes(id) ? s.ids.filter((x) => x !== id) : [...s.ids, id] })),
    }),
    { name: 'fav-storage' }
  )
);

export default useFavStore;
