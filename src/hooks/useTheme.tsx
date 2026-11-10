import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "system";
export const ACCENTS = [
  { id: "indigo", label: "Indigo", color: "#4F46E5" },
  { id: "violet", label: "Violet", color: "#7C3AED" },
  { id: "teal", label: "Teal", color: "#0D9488" },
  { id: "rose", label: "Rose", color: "#E11D48" },
] as const;

interface ThemeCtx {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  dark: boolean;
  toggle: () => void;
  accent: string;
  setAccent: (id: string) => void;
}
const Ctx = createContext<ThemeCtx | null>(null);

const read = (k: string, d: string) => {
  try {
    return localStorage.getItem(k) || d;
  } catch {
    return d;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => read("eduflow-theme", "light") as ThemeMode);
  const [accent, setAccent] = useState(() => read("eduflow-accent", "indigo"));
  const [sysDark, setSysDark] = useState(() => matchMedia("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const h = (e: MediaQueryListEvent) => setSysDark(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  const dark = mode === "dark" || (mode === "system" && sysDark);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    write("eduflow-theme", mode);
  }, [dark, mode]);
  useEffect(() => {
    const c = ACCENTS.find((a) => a.id === accent)?.color ?? ACCENTS[0].color;
    document.documentElement.style.setProperty("--color-primary", c);
    write("eduflow-accent", accent);
  }, [accent]);

  const value = useMemo(() => ({ mode, setMode, dark, toggle: () => setMode(dark ? "light" : "dark"), accent, setAccent }), [mode, dark, accent]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme must be inside ThemeProvider");
  return v;
}
