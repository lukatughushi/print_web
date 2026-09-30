import { create } from 'zustand';

let timer;

// Global one-line notification, e.g. "… — კალათაში დაემატა" (see components/Toast).
const useToast = create((set) => ({
  message: '',
  show: (message) => {
    clearTimeout(timer);
    set({ message });
    timer = setTimeout(() => set({ message: '' }), 1800);
  },
}));

export default useToast;
