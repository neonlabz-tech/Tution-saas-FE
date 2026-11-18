import { useCallback, useEffect, useRef, useState } from "react";
import { getStudentById, listStudents } from "@/api/students";
import type { StudentDetail, StudentListResponse, StudentQueryParams } from "@/types";

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

export function useStudents(params: StudentQueryParams) {
  const [data, setData] = useState<StudentListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const reqIdRef = useRef(0);

  const { q, batch, moduleId, status, page, limit, sortBy, sortOrder } = params;

  const refetch = useCallback(() => {
    setReloadTick((t) => t + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const reqId = ++reqIdRef.current;

    setLoading(true);
    setError(null);

    listStudents({ q, batch, moduleId, status, page, limit, sortBy, sortOrder }, controller.signal)
      .then((res) => {
        if (reqId !== reqIdRef.current) return;
        setData(res);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (isAbortError(err) || reqId !== reqIdRef.current) return;
        setError(err instanceof Error ? err.message : "Failed to load students");
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [q, batch, moduleId, status, page, limit, sortBy, sortOrder, reloadTick]);

  return { data, loading, error, refetch };
}

export function useStudentDetail(studentId: string | null, refreshKey = 0) {
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [internalTick, setInternalTick] = useState(0);
  const reqIdRef = useRef(0);

  const refresh = useCallback(() => {
    setInternalTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!studentId) {
      setStudent(null);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const reqId = ++reqIdRef.current;

    setLoading(true);
    setError(null);

    getStudentById(studentId, controller.signal)
      .then((res) => {
        if (reqId !== reqIdRef.current) return;
        setStudent(res);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (isAbortError(err) || reqId !== reqIdRef.current) return;
        setError(err instanceof Error ? err.message : "Failed to load student profile");
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [studentId, refreshKey, internalTick]);

  return { student, setStudent, loading, error, refresh };
}
