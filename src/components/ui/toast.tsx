import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Kind = "success" | "error" | "info";
export interface ToastAction {
  label: string;
  onClick: () => void;
}
interface ToastItem {
  id: number;
  kind: Kind;
  message: string;
  action?: ToastAction;
}
interface ToastApi {
  success: (m: string, action?: ToastAction) => void;
  error: (m: string, action?: ToastAction) => void;
  info: (m: string, action?: ToastAction) => void;
}
const Ctx = createContext<ToastApi | null>(null);
let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => setItems((p) => p.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (kind: Kind, message: string, action?: ToastAction) => {
      const id = ++counter;
      setItems((p) => [...p.slice(-3), { id, kind, message, action }]);
      const duration = action ? 7000 : 3800;
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );
  const api = useMemo<ToastApi>(
    () => ({
      success: (m, action) => push("success", m, action),
      error: (m, action) => push("error", m, action),
      info: (m, action) => push("info", m, action),
    }),
    [push],
  );
  const icons = { success: CheckCircle2, error: AlertCircle, info: Info };
  const tones = { success: "text-emerald-500", error: "text-rose-500", info: "text-primary" };
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 pb-[env(safe-area-inset-bottom,0px)]">
        <AnimatePresence>
          {items.map((t) => {
            const Icon = icons[t.kind];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40 }}
                className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-pop"
              >
                <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", tones[t.kind])} />
                <p className="flex-1 text-sm font-medium text-ink">{t.message}</p>
                {t.action && (
                  <button
                    onClick={() => {
                      t.action?.onClick();
                      dismiss(t.id);
                    }}
                    className="shrink-0 rounded-lg bg-surface-2 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
                  >
                    {t.action.label}
                  </button>
                )}
                <button onClick={() => dismiss(t.id)} className="text-muted hover:text-ink" aria-label="Dismiss">
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToast must be inside ToastProvider");
  return v;
}
