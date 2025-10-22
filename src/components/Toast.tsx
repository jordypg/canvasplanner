"use client";

import { useEffect, useState } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastProps {
  message: ToastMessage;
  onClose: (id: string) => void;
}

function Toast({ message, onClose }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const duration = message.duration || 3000;
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onClose(message.id), 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [message, onClose]);

  const typeStyles = {
    success: "bg-green-500 border-green-600",
    error: "bg-red-500 border-red-600",
    info: "bg-blue-500 border-blue-600",
    warning: "bg-yellow-500 border-yellow-600",
  };

  const typeIcons = {
    success: "✓",
    error: "✕",
    info: "ℹ",
    warning: "⚠",
  };

  return (
    <div
      className={`${typeStyles[message.type]} border-l-4 px-4 py-3 rounded shadow-lg text-white transition-all duration-300 ${
        isExiting ? "opacity-0 translate-x-full" : "opacity-100 translate-x-0"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-xl font-bold">{typeIcons[message.type]}</span>
        <p className="text-sm font-medium">{message.message}</p>
        <button
          type="button"
          onClick={() => {
            setIsExiting(true);
            setTimeout(() => onClose(message.id), 300);
          }}
          className="ml-auto text-white hover:text-gray-200 transition-colors"
          aria-label="Close notification"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default function ToastContainer({
  toasts,
  onClose
}: {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <div className="flex flex-col gap-2 pointer-events-auto">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast}
            onClose={onClose}
          />
        ))}
      </div>
    </div>
  );
}
