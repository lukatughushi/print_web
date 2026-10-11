import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import useToast from './toastStore';
import { currentLang, translate } from '../i18n/i18n-context';
import { productName } from '../i18n/products';

const useCartStore = create(
  persist(
    (set) => ({
      items: [],
      // Every add (product card, product page, constructor) confirms with a toast.
      addItem: (item) => {
        set((s) => ({ items: [...s.items, item] }));
        const lang = currentLang();
        const name = item.productName ? productName(item.productName, lang) : translate('პროდუქტი', lang);
        useToast.getState().show(translate('{name} — კალათაში დაემატა', lang, { name }));
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
