import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { loadBatches, loadClasses, resolveProfile } from "@/lib/teacherApi";
import { makeActor, type Actor } from "@/lib/teacherPolicy";
import type { TeacherBatch, TeacherClass, TeacherProfile } from "@/types/teacher";

interface TeacherCtx {
  profile: TeacherProfile | null;
  actor: Actor | null;
  batches: TeacherBatch[];
  classes: TeacherClass[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  patchClass: (c: TeacherClass) => void;
  instituteName: string;
}
const Ctx = createContext<TeacherCtx | null>(null);

/** Loads the signed-in teacher's profile, assigned batches and class calendar once for the whole /teacher area. */
export function TeacherPortalProvider({ children }: { children: ReactNode }) {
  const { user, config } = useAuth();
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [batches, setBatches] = useState<TeacherBatch[]>([]);
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const isTeacher = user?.role === "teacher";
  useEffect(() => {
    if (!user || !isTeacher) {
      setProfile(null);
      setBatches([]);
      setClasses([]);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    (async () => {
      const p = await resolveProfile(user);
      const b = await loadBatches(p);
      const a = makeActor(p.teacherId, user.id, b);
      const c = await loadClasses(a, p, b);
      if (!active) return;
      setProfile(p);
      setBatches(b);
      setClasses(c);
    })()
      .catch((e) => active && setError(e instanceof Error ? e.message : "Could not load your teaching data."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [user, isTeacher, tick]);

  const actor = useMemo(() => (profile && user ? makeActor(profile.teacherId, user.id, batches) : null), [profile, user, batches]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  const patchClass = useCallback((c: TeacherClass) => setClasses((prev) => prev.map((x) => (x.id === c.id ? c : x))), []);
  const value = useMemo(
    () => ({ profile, actor, batches, classes, loading, error, reload, patchClass, instituteName: config?.instituteName ?? "Bright Future Institute" }),
    [profile, actor, batches, classes, loading, error, reload, patchClass, config],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useTeacherPortal() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTeacherPortal must be used inside TeacherPortalProvider");
  return ctx;
}
