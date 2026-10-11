import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import useToast from './toastStore';

const useCartStore = create(
  persist(
    (set) => ({
      items: [],
      // Every add (product card, product page, constructor) confirms with a toast.
      addItem: (item) => {
        set((s) => ({ items: [...s.items, item] }));
        useToast.getState().show(`${item.productName || 'პროდუქტი'} — კალათაში დაემატა`);
      },
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
