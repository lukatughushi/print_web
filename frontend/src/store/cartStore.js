import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useCartStore = create(
  persist(
    (set) => ({
      items: [],
      addItem: (item) => set((s) => ({ items: [...s.items, item] })),
      removeItem: (index) => set((s) => ({ items: s.items.filter((_, i) => i !== index) })),
      setQty: (index, quantity) => set((s) => ({
        items: s.items.map((it, i) => (i === index ? { ...it, quantity: Math.max(1, quantity) } : it)),
      })),
      updateItem: (index, patch) => set((s) => ({
        items: s.items.map((it, i) => (i === index ? { ...it, ...patch } : it)),
      })),
      clear: () => set({ items: [] }),
    }),
    { name: 'cart-storage' }
  )
);

export default useCartStore;
