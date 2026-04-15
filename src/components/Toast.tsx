"use client";

import { useEffect } from "react";

interface ToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  return (
    <div className="fixed bottom-6 left-4 right-4 z-[100] mx-auto max-w-6xl animate-[slideUp_0.3s_ease-out]">
      <div className="flex items-center gap-3 rounded-xl bg-charcoal px-5 py-3 shadow-lg">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-white">
            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
          </svg>
        </div>
        <p className="font-sans text-sm font-medium text-white">{message}</p>
      </div>
    </div>
  );
}
