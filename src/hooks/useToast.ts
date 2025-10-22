import { useState, useCallback } from "react";
import type { ToastMessage, ToastType } from "@/components/Toast";

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((type: ToastType, message: string, duration?: number) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast: ToastMessage = {
      id,
      type,
      message,
      duration,
    };
    setToasts((prev) => [...prev, newToast]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const success = useCallback((message: string, duration?: number) => {
    return addToast("success", message, duration);
  }, [addToast]);

  const error = useCallback((message: string, duration?: number) => {
    return addToast("error", message, duration);
  }, [addToast]);

  const info = useCallback((message: string, duration?: number) => {
    return addToast("info", message, duration);
  }, [addToast]);

  const warning = useCallback((message: string, duration?: number) => {
    return addToast("warning", message, duration);
  }, [addToast]);

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    info,
    warning,
  };
}
