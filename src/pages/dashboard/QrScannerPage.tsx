import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { QRCodeSVG } from "qrcode.react";
import { AlertCircle, Camera, CameraOff, Keyboard, ScanLine, Sparkles } from "lucide-react";
import type { Student } from "@/types";
import { Avatar, Button, Card, CardHeader, Field, Input, MockNote, PageHeader, Select } from "@/components/ui/primitives";
import { ScanResult } from "@/components/qr/ScanResult";
import { useToast } from "@/components/ui/toast";
import { useAppData } from "@/hooks/useAppData";
import { parseQrPayload, qrPayload } from "@/lib/utils";

const READER_ID = "eduflow-qr-reader";

export default function QrScannerPage() {
  const { students } = useAppData();
  const toast = useToast();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const runningRef = useRef(false);
  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [result, setResult] = useState<Student | null>(null);
  const [error, setError] = useState("");
  const [manual, setManual] = useState("");
  const [recent, setRecent] = useState<{ id: string; name: string; ok: boolean; at: string }[]>([]);
  const demoStudents = students.filter((s) => s.status === "active").slice(0, 12);
  const [demoId, setDemoId] = useState(demoStudents[0]?.id ?? "");
  const demo = students.find((s) => s.id === demoId);

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
    (raw: string) => {
      const code = parseQrPayload(raw);
      const s = students.find((x) => x.ref === code || x.id.toLowerCase() === code.toLowerCase());
      const at = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      if (!s) {
        setResult(null);
        setError("This code does not match any student record. Ask the student to show their EduFlow QR card.");
        setRecent((r) => [{ id: code.slice(0, 10), name: "Unknown code", ok: false, at }, ...r].slice(0, 6));
        toast.error("Unrecognised QR code");
        return false;
      }
      setError("");
      setResult(s);
      setRecent((r) => [{ id: s.id, name: s.fullName, ok: true, at }, ...r].slice(0, 6));
      toast.success(`Scanned ${s.fullName}`);
      return true;
    },
    [students, toast],
  );

  const start = async () => {
    setCameraError("");
    setError("");
    setResult(null);
    setStarting(true);
    try {
      const sc = scannerRef.current ?? new Html5Qrcode(READER_ID);
      scannerRef.current = sc;
      await sc.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (text) => {
          resolve(text);
          void stop();
        },
        () => undefined,
      );
      runningRef.current = true;
      setScanning(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setCameraError(/permission|denied|notallowed/i.test(msg) ? "Camera permission was denied. Allow camera access in your browser, or use manual entry." : "No camera could be started on this device. Use manual entry below instead.");
      toast.error("Could not open the camera");
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
      <PageHeader title="QR Scanner" description="Scan a student's QR card to verify identity, mark attendance, or record a payment." />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader title="Camera scanner" subtitle="Point the camera at a student QR code" action={scanning && <Button size="sm" variant="dangerSoft" onClick={stop}><CameraOff className="h-3.5 w-3.5" /> Close scanner</Button>} />
            <div className="p-5">
              <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-3xl bg-slate-950">
                <div id={READER_ID} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
                {!scanning && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-900 to-indigo-950 p-6 text-center text-white">
                    <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl border border-white/20 bg-white/5">
                      <ScanLine className="h-10 w-10 text-teal-300" />
                      {["left-0 top-0 border-l-2 border-t-2 rounded-tl-2xl", "right-0 top-0 border-r-2 border-t-2 rounded-tr-2xl", "left-0 bottom-0 border-l-2 border-b-2 rounded-bl-2xl", "right-0 bottom-0 border-r-2 border-b-2 rounded-br-2xl"].map((c) => <span key={c} className={`absolute h-5 w-5 border-teal-300 ${c}`} />)}
                    </div>
                    <p className="max-w-[240px] text-sm text-white/70">{cameraError || "Camera is off. Start the scanner to read a QR code."}</p>
                    <Button onClick={start} disabled={starting}><Camera className="h-4 w-4" /> {starting ? "Starting…" : "Open camera scanner"}</Button>
                  </div>
                )}
                {scanning && <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 animate-pulse bg-gradient-to-r from-transparent via-teal-300 to-transparent" />}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><Keyboard className="h-4 w-4 text-brand" /> Manual entry</span>} subtitle="Fallback if the camera is unavailable" />
            <form className="flex gap-2 p-5" onSubmit={(e) => { e.preventDefault(); if (manual.trim()) { resolve(manual); setManual(""); } }}>
              <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Student ID (STU-…) or QR reference" className="num" />
              <Button type="submit" disabled={!manual.trim()}>Look up</Button>
            </form>
          </Card>
        </div>

        <div className="space-y-6">
          {error && (
            <div className="flex gap-3 rounded-3xl border border-rose-500/30 bg-rose-500/10 p-5">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
              <div><p className="font-heading text-sm font-bold text-rose-600 dark:text-rose-400">Scan failed</p><p className="mt-1 text-sm text-muted">{error}</p></div>
            </div>
          )}
          {result ? (
            <ScanResult student={result} onDismiss={() => setResult(null)} />
          ) : (
            !error && (
              <Card className="flex min-h-[220px] flex-col items-center justify-center p-8 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-brand"><ScanLine className="h-7 w-7" /></div>
                <h3 className="font-heading text-base font-bold">Waiting for a scan</h3>
                <p className="mt-1 max-w-xs text-sm text-muted">Student details, modules and outstanding payments appear here after a successful scan.</p>
              </Card>
            )
          )}

          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-500" /> Try it with demo codes</span>} subtitle="Scan this QR from another device, or simulate a scan" />
            <div className="grid gap-5 p-5 sm:grid-cols-[auto_1fr]">
              <div className="mx-auto rounded-2xl border border-line bg-white p-3">{demo && <QRCodeSVG value={qrPayload(demo.ref)} size={132} level="M" />}</div>
              <div className="space-y-3">
                <Field label="Demo student">
                  <Select value={demoId} onChange={(e) => setDemoId(e.target.value)}>{demoStudents.map((s) => <option key={s.id} value={s.id}>{s.fullName} — {s.id}</option>)}</Select>
                </Field>
                {demo && <div className="flex items-center gap-2"><Avatar name={demo.fullName} size="sm" /><span className="text-xs text-muted">Payload: <span className="num">{qrPayload(demo.ref).slice(0, 16)}…</span></span></div>}
                <Button variant="soft" onClick={() => demo && resolve(qrPayload(demo.ref))}>Simulate scan</Button>
              </div>
            </div>
            <div className="px-5 pb-5"><MockNote>QR codes contain only an opaque reference. Matching runs against local mock records; real validation and permissions will be handled by the backend later.</MockNote></div>
          </Card>

          {recent.length > 0 && (
            <Card>
              <CardHeader title="Recent scans" subtitle="This session" />
              <ul className="divide-y divide-line/70 p-3">
                {recent.map((r, i) => (
                  <li key={i} className="flex items-center justify-between px-2 py-2.5 text-sm">
                    <span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${r.ok ? "bg-emerald-500" : "bg-rose-500"}`} /><b className="font-semibold">{r.name}</b><span className="num text-xs text-muted">{r.id}</span></span>
                    <span className="text-xs text-muted">{r.at}</span>
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
