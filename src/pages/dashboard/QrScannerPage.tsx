import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertCircle,
  Camera,
  CameraOff,
  History,
  Keyboard,
  RefreshCw,
  ScanLine,
  SlidersHorizontal,
  Sparkles,
  Zap,
} from "lucide-react";
import type { AttendanceRecord, Student } from "@/types";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  MockNote,
  PageHeader,
  Select,
} from "@/components/ui/primitives";
import { ScanResult } from "@/components/qr/ScanResult";
import { useToast } from "@/components/ui/toast";
import { useAppData } from "@/hooks/useAppData";
import { attendanceApi, type VerifyQrResponse } from "@/lib/api";
import { parseQrPayload, playScanFeedback, qrPayload, todayISO } from "@/lib/utils";

const READER_ID = "eduflow-qr-reader";

interface RecentScan {
  id: string;
  name: string;
  status: "Present" | "Duplicate" | "Verified" | "Not Enrolled" | "Failed";
  ok: boolean;
  at: string;
}

export default function QrScannerPage() {
  const { students, modules, markAttendance, refreshStudents } = useAppData();
  const toast = useToast();

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

  const [selectedModuleId, setSelectedModuleId] = useState<string>("all");
  const [autoMark, setAutoMark] = useState(true);

  const [result, setResult] = useState<Student | null>(null);
  const [verifyData, setVerifyData] = useState<VerifyQrResponse | null>(null);
  const [error, setError] = useState("");
  const [manual, setManual] = useState("");
  const [recent, setRecent] = useState<RecentScan[]>([]);

  const demoStudents = students.filter((s) => s.status === "active").slice(0, 12);
  const [demoId, setDemoId] = useState(demoStudents[0]?.id ?? "");
  const demo = students.find((s) => s.id === demoId);

  // Discover available cameras
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devs) => {
        if (devs && devs.length > 0) {
          setCameras(devs.map((d) => ({ id: d.id, label: d.label || `Camera ${d.id.slice(0, 4)}` })));
          // Prefer back/environment camera if available
          const back = devs.find((d) => /back|rear|environment/i.test(d.label));
          setSelectedCameraId(back ? back.id : devs[0].id);
        }
      })
      .catch(() => {
        // Will prompt on user start action
      });
  }, []);

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
      const targetModule = selectedModuleId !== "all" ? selectedModuleId : undefined;

      try {
        const verifyRes = await attendanceApi.verifyQr({
          code,
          moduleId: targetModule,
          date: todayISO(),
        });

        setVerifyData(verifyRes);

        // Find or build student object
        const local = students.find(
          (s) => s.id.toLowerCase() === verifyRes.student.id.toLowerCase() || s.ref === verifyRes.student.ref,
        );

        const currentStudent: Student = local ?? {
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
          enrollmentDate: todayISO(),
        };

        setResult(currentStudent);
        setError("");

        // Check if student was already marked today in this module
        if (verifyRes.alreadyMarked) {
          playScanFeedback("warning");
          toast.info(
            `${currentStudent.fullName} is already marked for today in ${
              modules.find((m) => m.id === targetModule)?.code ?? "this module"
            }`,
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

        // Check enrollment if module selected
        if (targetModule && verifyRes.enrolledInModule === false) {
          playScanFeedback("warning");
          toast.error(
            `${currentStudent.fullName} is not enrolled in ${
              modules.find((m) => m.id === targetModule)?.name ?? "this module"
            }`,
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

        // Auto-mark present if enabled
        const moduleToMark = targetModule ?? currentStudent.moduleIds[0];
        if (autoMark && moduleToMark) {
          try {
            await attendanceApi.markQr({
              code: currentStudent.id,
              moduleId: moduleToMark,
              date: todayISO(),
              status: "present",
            });
            markAttendance(currentStudent.id, moduleToMark, todayISO(), "present", "qr");
            playScanFeedback("success");
            toast.success(
              `Marked ${currentStudent.fullName} present (${modules.find((m) => m.id === moduleToMark)?.code ?? ""})`,
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
            markAttendance(currentStudent.id, moduleToMark, todayISO(), "present", "qr");
            playScanFeedback("success");
            toast.success(`Marked ${currentStudent.fullName} present`);
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
          toast.success(`Verified ${currentStudent.fullName}`);
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
            toast.success(`Scanned ${local.fullName}`);
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
        setError("This QR code does not match any student record. Ask the student to display their valid EduFlow QR pass.");
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
    [selectedModuleId, students, modules, autoMark, markAttendance, toast],
  );

  const start = async () => {
    setCameraError("");
    setError("");
    setResult(null);
    setVerifyData(null);
    setStarting(true);

    try {
      const sc = scannerRef.current ?? new Html5Qrcode(READER_ID);
      scannerRef.current = sc;

      const cameraConfig = selectedCameraId
        ? { deviceId: { exact: selectedCameraId } }
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

      {/* Target Module & Auto-mark Controls Toolbar */}
      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-muted">
              <SlidersHorizontal className="h-3.5 w-3.5 text-brand" /> Active class / module:
            </span>
            <div className="w-64">
              <Select
                value={selectedModuleId}
                onChange={(e) => setSelectedModuleId(e.target.value)}
                aria-label="Active module for attendance"
              >
                <option value="all">Auto-detect from student profile</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.code})
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs font-semibold text-ink cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoMark}
                onChange={(e) => setAutoMark(e.target.checked)}
                className="h-4 w-4 rounded accent-[#9828FD]"
              />
              <span className="flex items-center gap-1">
                <Zap className="h-3.5 w-3.5 text-brand" /> Auto-mark Present on scan
              </span>
            </label>

            {cameras.length > 1 && (
              <div className="w-48">
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
          </div>
        </div>
      </Card>

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
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-500 animate-pulse">
                      ● Live
                    </span>
                  )}
                </span>
              }
              subtitle="Align student QR code within the target frame"
              action={
                scanning && (
                  <Button size="sm" variant="dangerSoft" onClick={stop}>
                    <CameraOff className="h-3.5 w-3.5" /> Stop scanner
                  </Button>
                )
              }
            />

            <div className="p-5">
              <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-3xl bg-slate-950 shadow-inner">
                <div id={READER_ID} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />

                {!scanning && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-center text-white">
                    <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl border border-white/20 bg-white/5 shadow-2xl">
                      <ScanLine className="h-10 w-10 text-[#4589FF]" />
                      {[
                        "left-0 top-0 border-l-2 border-t-2 rounded-tl-2xl",
                        "right-0 top-0 border-r-2 border-t-2 rounded-tr-2xl",
                        "left-0 bottom-0 border-l-2 border-b-2 rounded-bl-2xl",
                        "right-0 bottom-0 border-r-2 border-b-2 rounded-br-2xl",
                      ].map((c) => (
                        <span key={c} className={`absolute h-5 w-5 border-[#9828FD] ${c}`} />
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
                    <div className="pointer-events-none absolute inset-x-12 top-1/2 h-0.5 animate-pulse bg-gradient-to-r from-transparent via-[#4589FF] to-transparent shadow-[0_0_12px_#4589FF]" />
                    <div className="pointer-events-none absolute inset-10 rounded-2xl border-2 border-[#9828FD]/40" />
                  </>
                )}
              </div>
            </div>
          </Card>

          {/* Manual Entry Fallback */}
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Keyboard className="h-4 w-4 text-brand" /> Manual Entry & Handheld Reader
                </span>
              }
              subtitle="Type a Student ID (STU-…) or paste barcode scanner input"
            />
            <form
              className="flex gap-2 p-5 pt-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (manual.trim()) {
                  void resolve(manual.trim());
                  setManual("");
                }
              }}
            >
              <Input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="STU-2026-001 or QR ref code…"
                className="num font-mono"
              />
              <Button type="submit" disabled={!manual.trim()}>
                Verify
              </Button>
            </form>
          </Card>
        </div>

        {/* Right Column: Verification Results & Feed */}
        <div className="space-y-6">
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
              initialModuleId={selectedModuleId !== "all" ? selectedModuleId : undefined}
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

          {/* Demo codes simulator */}
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" /> Test with demo QR codes
                </span>
              }
              subtitle="Simulate quick scans or scan on screen using a mobile camera"
            />
            <div className="grid gap-5 p-5 sm:grid-cols-[auto_1fr]">
              <div className="mx-auto rounded-2xl border border-line bg-white p-3 shadow-sm">
                {demo && <QRCodeSVG value={qrPayload(demo.ref)} size={128} level="M" />}
              </div>
              <div className="space-y-3">
                <Field label="Choose demo student">
                  <Select value={demoId} onChange={(e) => setDemoId(e.target.value)}>
                    {demoStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName} ({s.id})
                      </option>
                    ))}
                  </Select>
                </Field>
                {demo && (
                  <div className="flex items-center gap-2">
                    <Avatar name={demo.fullName} size="sm" />
                    <span className="text-xs text-muted">
                      Payload: <span className="num font-mono">{qrPayload(demo.ref).slice(0, 16)}…</span>
                    </span>
                  </div>
                )}
                <Button
                  variant="soft"
                  onClick={() => demo && void resolve(qrPayload(demo.ref))}
                >
                  <Zap className="h-3.5 w-3.5" /> Simulate Scan
                </Button>
              </div>
            </div>
            <div className="px-5 pb-5">
              <MockNote>
                QR codes contain opaque student references. Verification validates identity, module enrollment, and duplicate status against the API.
              </MockNote>
            </div>
          </Card>

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
                            ? "bg-emerald-500"
                            : r.status === "Duplicate"
                            ? "bg-amber-500"
                            : r.status === "Verified"
                            ? "bg-[#4589FF]"
                            : "bg-rose-500"
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
