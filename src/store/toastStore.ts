import { create } from 'zustand';
import type { ToastVariant } from '@/components/molecules';

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  autoDismiss?: boolean;
  autoDismissMs?: number;
}

interface ToastState {
  toasts: ToastItem[];
}

interface ToastActions {
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
}

export type ToastStore = ToastState & ToastActions;

let toastCounter = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `toast-${++toastCounter}-${Date.now()}`;
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

export function useToast() {
  const addToast = useToastStore((state) => state.addToast);
  const removeToast = useToastStore((state) => state.removeToast);

  return {
    toast: addToast,
    dismiss: removeToast,
    success: (message: string) => addToast({ variant: 'success', message }),
    error: (message: string) => addToast({ variant: 'error', message }),
    info: (message: string) => addToast({ variant: 'info', message }),
    warning: (message: string) => addToast({ variant: 'warning', message }),
  };
}
