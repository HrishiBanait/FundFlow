"use client";
import { createContext, useCallback, useContext, useState } from "react";

type Kind = "success" | "error" | "info";
type ToastItem = { id: number; kind: Kind; text: string };

const ToastContext = createContext<{ notify: (kind: Kind, text: string) => void }>({
  notify: () => {},
});
export const useToast = () => useContext(ToastContext);

const STYLES: Record<Kind, string> = {
  success: "border-green-300 bg-green-50 text-green-800",
  error: "border-red-300 bg-red-50 text-red-800",
  info: "border-blue-300 bg-blue-50 text-blue-800",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // useCallback keeps `notify` stable, so effects that depend on it don't re-run every render
  const notify = useCallback((kind: Kind, text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`rounded-lg border px-4 py-3 text-sm shadow-md ${STYLES[t.kind]}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}