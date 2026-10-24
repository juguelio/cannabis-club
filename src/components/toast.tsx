"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";

type Toast = { id: number; tone: "ok" | "bad"; title: string; text?: string };
const Ctx = createContext<(t: Omit<Toast, "id">) => void>(() => undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.slice(-2), { ...t, id }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), t.tone === "bad" ? 7000 : 4200);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="toast" data-tone={t.tone} role={t.tone === "bad" ? "alert" : "status"}>
            {t.tone === "ok" ? <CircleCheck aria-hidden /> : <CircleAlert aria-hidden />}
            <div>
              <b>{t.title}</b>
              {t.text ? <span>{t.text}</span> : null}
            </div>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
