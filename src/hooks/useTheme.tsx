import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "system";
export const ACCENTS = [
  { id: "medium-purple", label: "Medium Purple", color: "#8B51BE" },
  { id: "soft-lilac", label: "Soft Lilac", color: "#BC99D9" },
  { id: "vibrant-violet", label: "Vibrant Violet", color: "#A771CF" },
  { id: "pastel-lavender", label: "Pastel Lavender", color: "#CBADE3" },
  { id: "deep-violet", label: "Deep Violet", color: "#7948A2" },
  { id: "royal-purple", label: "Royal Purple", color: "#4D1882" },
  { id: "midnight-plum", label: "Midnight Plum", color: "#693AA0" },
] as const;

export type AccentId = (typeof ACCENTS)[number]["id"];

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
  const [accent, setAccent] = useState(() => {
    const saved = read("eduflow-accent", "medium-purple");
    return ACCENTS.some((a) => a.id === saved) ? saved : "medium-purple";
  });
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
