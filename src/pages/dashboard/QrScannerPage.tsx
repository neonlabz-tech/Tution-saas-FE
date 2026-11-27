import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import {
  AlertCircle,
  BookOpen,
  Camera,
  CameraOff,
  History,
  Keyboard,
  RefreshCw,
  ScanLine,
} from "lucide-react";
import type { AttendanceRecord, Student, StudentPaymentStatus } from "@/types";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Input,
  PageHeader,
  Select,
  StatusBadge,
} from "@/components/ui/primitives";
import { ScanResult } from "@/components/qr/ScanResult";
import { useToast } from "@/components/ui/toast";
import { useAppData, formatModuleName } from "@/hooks/useAppData";
import { attendanceApi, type VerifyQrResponse } from "@/lib/api";
import { parseQrPayload, playScanFeedback, todayISO } from "@/lib/utils";

const READER_ID = "eduflow-qr-reader";

interface RecentScan {
  id: string;
  name: string;
  status: "Present" | "Duplicate" | "Verified" | "Not Enrolled" | "Failed";
  ok: boolean;
  at: string;
}

export default function QrScannerPage() {
  const { students, modules, classes, attendance, getModule, markAttendance, refreshStudents } = useAppData();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    void refreshStudents();
  }, [refreshStudents]);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const runningRef = useRef(false);

  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");

  const paramModule = searchParams.get("moduleId") || "all";
  const [selectedModuleId, setSelectedModuleId] = useState<string>(paramModule);

  useEffect(() => {
    const pm = searchParams.get("moduleId");
    if (pm && pm !== selectedModuleId) {
      setSelectedModuleId(pm);
    }
  }, [searchParams]);

  const handleModuleChange = (newModuleId: string) => {
    setSelectedModuleId(newModuleId);
    if (newModuleId !== "all") {
      setSearchParams({ moduleId: newModuleId });
    } else {
      const next = new URLSearchParams(searchParams);
      next.delete("moduleId");
      setSearchParams(next);
    }
  };

  const availableModules = useMemo(() => {
    return modules
      .map((m) => ({ id: m.id, name: formatModuleName(m.name || m.id, modules), code: m.code }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [modules]);

  // Require manual module selection before marking present (prevent automatic mark on scan)
  const [autoMark] = useState(false);

  type ScannedStudent = Student & {
    feeTotal?: number;
    paidTotal?: number;
    outstanding?: number;
    paymentStatus?: StudentPaymentStatus;
  };

  const [result, setResult] = useState<ScannedStudent | null>(null);
  const [verifyData, setVerifyData] = useState<VerifyQrResponse | null>(null);
  const [error, setError] = useState("");
  const [manual, setManual] = useState("");
  const [recent, setRecent] = useState<RecentScan[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Suggestions matching the typed query (min 2 characters)
  const suggestions = useMemo(() => {
    const q = manual.trim().toLowerCase();
    if (q.length < 2) return [];
    return students
      .filter((s) => {
        return (
          s.fullName.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q) ||
          (s.phone && s.phone.includes(q)) ||
          (s.email && s.email.toLowerCase().includes(q)) ||
          (s.batch && s.batch.toLowerCase().includes(q))
        );
      })
      .slice(0, 6);
  }, [students, manual]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Camera list is populated only on user-initiated start
  const stop = useCallback(async () => {
    const sc = scannerRef.current;
    if (sc && runningRef.current) {
      runningRef.current = false;
      try {
        await sc.stop();
        sc.clear();
      } catch {
        /* already stopped */
      }
    }
    setScanning(false);
  }, []);

  const resolve = useCallback(
    async (raw: string) => {
      const code = parseQrPayload(raw);
      const at = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      const today = todayISO();

      // Find local student if possible to check enrollments
      const local = students.find(
        (s) => s.ref === code || s.id.toLowerCase() === code.toLowerCase(),
      );

      const studentMids = local?.moduleIds ?? [];
      const validStudentMids = studentMids.filter(
        (mid) => !/^[0-9a-f]{6,}$/i.test(mid.replace(/^mod_/i, "")),
      );

      // Determine target subject for multi-subject students:
      let targetModule: string | undefined = undefined;

      if (selectedModuleId !== "all") {
        targetModule = selectedModuleId;
      } else if (validStudentMids.length > 0) {
        // Multi-subject student handling:
        // 1. Check if an active/scheduled class exists today for one of the student's enrolled modules
        const todayClass = classes.find((c) => {
          if (c.status === "cancelled") return false;
          const cDate = c.start.slice(0, 10);
          return (
            cDate === today &&
            validStudentMids.some(
              (mid) =>
                mid.toLowerCase() === c.moduleId.toLowerCase() ||
                getModule(mid)?.code?.toLowerCase() === c.moduleId.toLowerCase(),
            )
          );
        });

        // 2. Check today's attendance records to find which enrolled modules are already marked
        const markedMidsToday = new Set(
          attendance
            .filter(
              (a) =>
                (a.studentId === local?.id || a.studentId.toLowerCase() === code.toLowerCase()) &&
                a.date === today &&
                a.status === "present",
            )
            .map((a) => a.moduleId.toLowerCase()),
        );

        const unmarkedMids = validStudentMids.filter(
          (mid) =>
            !markedMidsToday.has(mid.toLowerCase()) &&
            !markedMidsToday.has(getModule(mid)?.id?.toLowerCase() ?? ""),
        );

        if (
          todayClass &&
          unmarkedMids.some(
            (mid) =>
              mid.toLowerCase() === todayClass.moduleId.toLowerCase() ||
              getModule(mid)?.id?.toLowerCase() === todayClass.moduleId.toLowerCase(),
          )
        ) {
          targetModule = todayClass.moduleId;
        } else if (unmarkedMids.length > 0) {
          targetModule = unmarkedMids[0];
        } else {
          targetModule = validStudentMids[0];
        }
      }

      try {
        const verifyRes = await attendanceApi.verifyQr({
          code,
          moduleId: targetModule,
          date: today,
        });

        setVerifyData(verifyRes);

        // Find or build student object
        const baseStudent: Student = local ?? {
          id: verifyRes.student.id,
          ref: verifyRes.student.ref,
          fullName: verifyRes.student.fullName,
          email: verifyRes.student.email ?? "",
          phone: verifyRes.student.phone ?? "",
          dob: "2006-01-01",
          address: "Colombo, Sri Lanka",
          guardianName: "Guardian",
          guardianPhone: verifyRes.student.phone ?? "",
          batch: verifyRes.student.batch ?? "2026",
          status: (verifyRes.student.status as Student["status"]) ?? "active",
          moduleIds: verifyRes.student.moduleIds ?? [],
          enrollmentDate: today,
        };

        const currentStudent: ScannedStudent = {
          ...baseStudent,
          feeTotal: verifyRes.student.feeTotal,
          paidTotal: verifyRes.student.paidTotal,
          outstanding: verifyRes.student.outstanding,
          paymentStatus: verifyRes.student.paymentStatus,
        };

        setResult(currentStudent);
        setError("");

        // Check enrollment if module selected
        if (targetModule && verifyRes.enrolledInModule === false) {
          playScanFeedback("warning");
          const modName = formatModuleName(targetModule, modules);
          toast.error(
            `${currentStudent.fullName} is not enrolled in ${modName}`,
          );
          const entry: RecentScan = {
            id: currentStudent.id,
            name: currentStudent.fullName,
            status: "Not Enrolled",
            ok: false,
            at,
          };
          setRecent((r) => [entry, ...r].slice(0, 10));
          return false;
        }

        // Check if student was already marked today in this module
        if (verifyRes.alreadyMarked) {
          playScanFeedback("warning");
          const modName = formatModuleName(targetModule, modules);
          const method = verifyRes.existingAttendance?.method ?? "manual";
          toast.info(
            `${currentStudent.fullName} is already marked for today in ${modName} (via ${method})`,
          );
          const entry: RecentScan = {
            id: currentStudent.id,
            name: currentStudent.fullName,
            status: "Duplicate",
            ok: true,
            at,
          };
          setRecent((r) => [entry, ...r].slice(0, 10));
          return true;
        }

        // Auto-mark present if enabled
        const moduleToMark = targetModule ?? currentStudent.moduleIds[0];
        if (autoMark && moduleToMark) {
          const modName = formatModuleName(moduleToMark, modules);
          try {
            await attendanceApi.markQr({
              code: currentStudent.id,
              moduleId: moduleToMark,
              date: today,
              status: "present",
            });
            markAttendance(currentStudent.id, moduleToMark, today, "present", "qr");
            playScanFeedback("success");
            toast.success(
              `Marked ${currentStudent.fullName} present in ${modName}`,
            );
            const entry: RecentScan = {
              id: currentStudent.id,
              name: currentStudent.fullName,
              status: "Present",
              ok: true,
              at,
            };
            setRecent((r) => [entry, ...r].slice(0, 10));
          } catch {
            markAttendance(currentStudent.id, moduleToMark, today, "present", "qr");
            playScanFeedback("success");
            toast.success(`Marked ${currentStudent.fullName} present in ${modName}`);
            const entry: RecentScan = {
              id: currentStudent.id,
              name: currentStudent.fullName,
              status: "Present",
              ok: true,
              at,
            };
            setRecent((r) => [entry, ...r].slice(0, 10));
          }
        } else {
          playScanFeedback("success");
          toast.success(`Verified ${currentStudent.fullName}. Select module to mark attendance.`);
          const entry: RecentScan = {
            id: currentStudent.id,
            name: currentStudent.fullName,
            status: "Verified",
            ok: true,
            at,
          };
          setRecent((r) => [entry, ...r].slice(0, 10));
        }

        return true;
      } catch (err) {
        // Fallback to local students search if offline
        const local = students.find(
          (s) => s.ref === code || s.id.toLowerCase() === code.toLowerCase(),
        );

        if (local) {
          setResult(local);
          setVerifyData(null);
          setError("");

          const moduleToMark = targetModule ?? local.moduleIds[0];
          if (autoMark && moduleToMark) {
            markAttendance(local.id, moduleToMark, todayISO(), "present", "qr");
            playScanFeedback("success");
            toast.success(`Marked ${local.fullName} present`);
            const entry: RecentScan = {
              id: local.id,
              name: local.fullName,
              status: "Present",
              ok: true,
              at,
            };
            setRecent((r) => [entry, ...r].slice(0, 10));
          } else {
            playScanFeedback("success");
            toast.success(`Verified ${local.fullName}. Select module to mark attendance.`);
            const entry: RecentScan = {
              id: local.id,
              name: local.fullName,
              status: "Verified",
              ok: true,
              at,
            };
            setRecent((r) => [entry, ...r].slice(0, 10));
          }
          return true;
        }

        const msg = err instanceof Error ? err.message : "Unrecognised QR code";
        playScanFeedback("error");
        setResult(null);
        setVerifyData(null);
        setError(msg || "This QR code or query does not match any student record.");
        const failedEntry: RecentScan = {
          id: code.slice(0, 12),
          name: "Unknown code",
          status: "Failed",
          ok: false,
          at,
        };
        setRecent((r) => [failedEntry, ...r].slice(0, 10));
        toast.error(msg);
        return false;
      }
    },
    [selectedModuleId, students, modules, classes, attendance, getModule, autoMark, markAttendance, toast],
  );

  const handleSelectStudent = useCallback(
    (student: Student) => {
      setManual("");
      setDropdownOpen(false);
      setSelectedIndex(-1);
      void resolve(student.id);
    },
    [resolve],
  );

  const start = async () => {
    setCameraError("");
    setError("");
    setResult(null);
    setVerifyData(null);
    setStarting(true);

    try {
      let targetCamId = selectedCameraId;
      if (cameras.length === 0) {
        try {
          const devs = await Html5Qrcode.getCameras();
          if (devs && devs.length > 0) {
            setCameras(devs.map((d) => ({ id: d.id, label: d.label || `Camera ${d.id.slice(0, 4)}` })));
            if (!targetCamId) {
              const back = devs.find((d) => /back|rear|environment/i.test(d.label));
              targetCamId = back ? back.id : devs[0].id;
              setSelectedCameraId(targetCamId);
            }
          }
        } catch {
          /* Fall back to standard environment camera */
        }
      }

      const sc = scannerRef.current ?? new Html5Qrcode(READER_ID);
      scannerRef.current = sc;

      const cameraConfig = targetCamId
        ? { deviceId: { exact: targetCamId } }
        : { facingMode: "environment" };

      await sc.start(
        cameraConfig,
        { fps: 15, qrbox: { width: 250, height: 250 } },
        (text) => {
          void resolve(text);
          void stop();
        },
        () => undefined,
      );

      runningRef.current = true;
      setScanning(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/permission|denied|notallowed/i.test(msg)) {
        setCameraError(
          "Camera permission was denied. Please allow camera permissions in your browser's site settings or address bar, then click Retry.",
        );
      } else if (/notfound|device/i.test(msg)) {
        setCameraError("No camera device was detected on your system. Use manual ID entry below to look up students.");
      } else {
        setCameraError("Could not access the camera. Ensure no other application is using it and click Retry.");
      }
      playScanFeedback("error");
      toast.error("Could not start camera scanner");
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    return () => {
      const sc = scannerRef.current;
      if (sc && runningRef.current) {
        runningRef.current = false;
        sc.stop().then(() => sc.clear()).catch(() => undefined);
      }
    };
  }, []);

  return (
    <>
      <PageHeader
        title="QR Scanner"
        description="Fast contactless attendance marking & student verification using high-speed QR camera scanning."
      />

      {/* Active Subject / Class Toolbar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2/60 p-3.5 px-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-brand" />
            <span className="text-xs font-semibold text-ink">Active Class / Subject:</span>
          </div>
          <div className="w-64 max-w-full">
            <Select
              value={selectedModuleId}
              onChange={(e) => handleModuleChange(e.target.value)}
              aria-label="Select target class or subject"
              className="h-9 text-xs font-semibold bg-surface"
            >
              <option value="all">⚡ Auto-detect subject</option>
              {availableModules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.code})
                </option>
              ))}
            </Select>
          </div>
        </div>

        {selectedModuleId !== "all" ? (
          <Badge tone="primary" className="text-xs font-semibold py-1 px-3">
            Targeting: {availableModules.find((m) => m.id === selectedModuleId)?.name ?? selectedModuleId}
          </Badge>
        ) : (
          <span className="text-xs text-muted">
            Auto-detects active/unmarked subject for students with multiple enrollments
          </span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Camera Viewfinder & Manual Entry */}
        <div className="space-y-6">
          <Card className="overflow-hidden border border-line">
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-brand" />
                  Camera scanner
                  {scanning && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#7D41AB]/15 px-2 py-0.5 text-[11px] font-bold text-[#7D41AB] animate-pulse">
                      ● Live
                    </span>
                  )}
                </span>
              }
              subtitle="Align student QR code within the target frame"
              action={
                <div className="flex items-center gap-2">
                  {cameras.length > 1 && (
                    <div className="w-40">
                      <Select
                        value={selectedCameraId}
                        onChange={(e) => setSelectedCameraId(e.target.value)}
                        aria-label="Select camera"
                      >
                        {cameras.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                  {scanning && (
                    <Button size="sm" variant="dangerSoft" onClick={stop}>
                      <CameraOff className="h-3.5 w-3.5" /> Stop scanner
                    </Button>
                  )}
                </div>
              }
            />

            <div className="p-5">
              <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-3xl bg-slate-950 shadow-inner">
                <div id={READER_ID} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />

                {!scanning && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-center text-white">
                    <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl border border-white/20 bg-white/5 shadow-2xl">
                      <ScanLine className="h-10 w-10 text-[#A771CF]" />
                      {[
                        "left-0 top-0 border-l-2 border-t-2 rounded-tl-2xl",
                        "right-0 top-0 border-r-2 border-t-2 rounded-tr-2xl",
                        "left-0 bottom-0 border-l-2 border-b-2 rounded-bl-2xl",
                        "right-0 bottom-0 border-r-2 border-b-2 rounded-br-2xl",
                      ].map((c) => (
                        <span key={c} className={`absolute h-5 w-5 border-[#7D41AB] ${c}`} />
                      ))}
                    </div>

                    <p className="max-w-[260px] text-xs text-white/70 leading-relaxed">
                      {cameraError || "Camera is idle. Start the scanner to read student QR cards."}
                    </p>

                    <div className="flex gap-2">
                      <Button onClick={start} disabled={starting}>
                        <Camera className="h-4 w-4" /> {starting ? "Starting…" : "Start camera scanner"}
                      </Button>
                      {cameraError && (
                        <Button variant="secondary" onClick={start} disabled={starting}>
                          <RefreshCw className="h-3.5 w-3.5" /> Retry
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Laser scan animation when camera is live */}
                {scanning && (
                  <>
                    <div className="pointer-events-none absolute inset-x-12 top-1/2 h-0.5 animate-pulse bg-gradient-to-r from-transparent via-[#A771CF] to-transparent shadow-[0_0_12px_#A771CF]" />
                    <div className="pointer-events-none absolute inset-10 rounded-2xl border-2 border-[#7D41AB]/40" />
                  </>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Manual Entry, Verification Results & Feed */}
        <div className="space-y-6">
          {/* Manual Entry Fallback */}
          <Card className="overflow-visible relative">
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Keyboard className="h-4 w-4 text-brand" /> Manual Entry & Handheld Reader
                </span>
              }
              subtitle="Type student name, Student ID, or phone number to see live suggestions"
            />
            <form
              ref={dropdownRef as any}
              className="p-5 pt-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
                  handleSelectStudent(suggestions[selectedIndex]);
                  return;
                }
                const trimmed = manual.trim();
                if (!trimmed) return;
                if (suggestions.length === 1) {
                  handleSelectStudent(suggestions[0]);
                  return;
                }
                if (trimmed.length < 3 && !trimmed.toUpperCase().startsWith("STU-")) {
                  toast.error("Please enter at least 3 characters to search by student name.");
                  return;
                }
                setDropdownOpen(false);
                void resolve(trimmed);
                setManual("");
              }}
            >
              <div className="flex flex-col sm:flex-row gap-2 relative">
                <div className="relative flex-1">
                  <Input
                    value={manual}
                    onChange={(e) => {
                      setManual(e.target.value);
                      setDropdownOpen(true);
                      setSelectedIndex(-1);
                    }}
                    onFocus={() => {
                      if (manual.trim().length >= 2) setDropdownOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (!dropdownOpen || suggestions.length === 0) return;
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
                      } else if (e.key === "Enter") {
                        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
                          e.preventDefault();
                          handleSelectStudent(suggestions[selectedIndex]);
                        }
                      } else if (e.key === "Escape") {
                        setDropdownOpen(false);
                      }
                    }}
                    placeholder="Type student name, STU-2026-001, or phone…"
                    className="font-medium"
                    autoComplete="off"
                  />

                  {/* Floating Dropdown suggestions */}
                  {dropdownOpen && manual.trim().length >= 2 && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-72 overflow-y-auto rounded-2xl border border-line bg-surface/95 backdrop-blur-md shadow-2xl divide-y divide-line/30">
                      {suggestions.length > 0 ? (
                        suggestions.map((s, idx) => {
                          const isSelected = idx === selectedIndex;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => handleSelectStudent(s)}
                              onMouseEnter={() => setSelectedIndex(idx)}
                              className={`flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors cursor-pointer ${
                                isSelected
                                  ? "bg-[#7D41AB]/15 text-foreground"
                                  : "hover:bg-surface-elevated text-foreground"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Avatar name={s.fullName} size="sm" />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="truncate font-heading text-sm font-bold text-foreground">
                                      {s.fullName}
                                    </p>
                                    <span className="shrink-0 rounded-md bg-muted/15 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-muted">
                                      {s.id}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-muted">
                                    {s.batch && <span>{s.batch}</span>}
                                    {s.batch && s.phone && <span>•</span>}
                                    {s.phone && <span>{s.phone}</span>}
                                  </div>
                                </div>
                              </div>
                              <div className="shrink-0 flex items-center gap-2">
                                <StatusBadge status={s.status} />
                                <span className="text-[11px] font-bold text-[#7D41AB] opacity-0 group-hover:opacity-100 sm:inline-block hidden">
                                  Select ↵
                                </span>
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className="px-4 py-3 text-center text-xs text-muted">
                          No student matching &ldquo;{manual.trim()}&rdquo;. Press{" "}
                          <span className="font-semibold text-foreground">Verify</span> to search via backend.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Button type="submit" disabled={!manual.trim()} className="w-full sm:w-auto">
                  Verify
                </Button>
              </div>
            </form>
          </Card>

          {error && (
            <div className="flex gap-3 rounded-3xl border border-rose-500/30 bg-rose-500/10 p-5 shadow-sm">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
              <div>
                <p className="font-heading text-sm font-bold text-rose-600 dark:text-rose-400">Scan Failed</p>
                <p className="mt-1 text-xs text-muted">{error}</p>
              </div>
            </div>
          )}

          {result ? (
            <ScanResult
              student={result}
              initialModuleId={
                selectedModuleId !== "all"
                  ? selectedModuleId
                  : verifyData?.module?.id ?? verifyData?.existingAttendance?.moduleId ?? result.moduleIds[0]
              }
              alreadyMarked={verifyData?.alreadyMarked}
              existingRecord={verifyData?.existingAttendance}
              verificationMessage={verifyData?.message}
              onDismiss={() => {
                setResult(null);
                setVerifyData(null);
                if (!scanning) void start();
              }}
              onMarkSuccess={(rec: AttendanceRecord) => {
                const markEntry: RecentScan = {
                  id: rec.studentId,
                  name: result.fullName,
                  status: "Present",
                  ok: true,
                  at: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
                };
                setRecent((r) => [
                  markEntry,
                  ...r.filter((x) => x.id !== rec.studentId),
                ].slice(0, 10));
              }}
            />
          ) : (
            !error && (
              <Card className="flex min-h-[220px] flex-col items-center justify-center p-8 text-center border-dashed">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-brand">
                  <ScanLine className="h-7 w-7" />
                </div>
                <h3 className="font-heading text-base font-bold">Waiting for student scan</h3>
                <p className="mt-1 max-w-xs text-xs text-muted">
                  Point the camera at an EduFlow student QR code or type an ID. Verification, duplicate check, and attendance marking happen instantly.
                </p>
              </Card>
            )
          )}

          {/* Session Scan History */}
          {recent.length > 0 && (
            <Card>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <History className="h-4 w-4 text-brand" /> Recent scans
                  </span>
                }
                subtitle="This scanning session"
              />
              <ul className="divide-y divide-line/70 p-3">
                {recent.map((r, i) => (
                  <li key={i} className="flex items-center justify-between px-3 py-2.5 text-xs">
                    <span className="flex items-center gap-2.5">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          r.status === "Present"
                            ? "bg-[#7D41AB]"
                            : r.status === "Duplicate"
                            ? "bg-[#A771CF]"
                            : r.status === "Verified"
                            ? "bg-[#BC99D9]"
                            : "bg-[#4D1882]"
                        }`}
                      />
                      <b className="font-semibold">{r.name}</b>
                      <span className="num font-mono text-muted">{r.id}</span>
                    </span>
                    <div className="flex items-center gap-3">
                      <Badge
                        tone={
                          r.status === "Present"
                            ? "teal"
                            : r.status === "Duplicate"
                            ? "amber"
                            : r.status === "Verified"
                            ? "primary"
                            : "rose"
                        }
                      >
                        {r.status}
                      </Badge>
                      <span className="num text-muted">{r.at}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
