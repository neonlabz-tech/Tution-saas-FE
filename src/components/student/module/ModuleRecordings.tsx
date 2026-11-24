import { useState } from "react";
import { Clock, ExternalLink, MonitorPlay, Play } from "lucide-react";
import { Button, Card, EmptyState } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/overlays";
import type { ClassRecording } from "@/types/student";
import { fmtDate } from "@/lib/utils";

const GRADS = ["from-indigo-500 to-violet-500", "from-teal-500 to-emerald-500", "from-sky-500 to-indigo-500", "from-fuchsia-500 to-purple-500"];

export function ModuleRecordings({ recordings }: { recordings: ClassRecording[] }) {
  const [active, setActive] = useState<ClassRecording | null>(null);
  const [failed, setFailed] = useState(false);
  const close = () => {
    setActive(null);
    setFailed(false);
  };

  if (recordings.length === 0) {
    return (
      <Card>
        <EmptyState icon={<MonitorPlay className="h-6 w-6" />} title="No recordings yet" text="Recordings of completed online classes are published here shortly after each session." />
      </Card>
    );
  }
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {recordings.map((r, i) => (
          <Card key={r.id} className="group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-pop">
            <button onClick={() => setActive(r)} aria-label={`Watch ${r.title}`} className={`relative flex aspect-video w-full cursor-pointer items-center justify-center bg-gradient-to-br ${GRADS[i % GRADS.length]}`}>
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-primary shadow-lg transition group-hover:scale-110"><Play className="ml-0.5 h-6 w-6 fill-current" /></span>
              <span className="num absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-white">{r.durationMin} min</span>
            </button>
            <div className="p-4">
              <h3 className="line-clamp-2 text-sm font-bold leading-snug">{r.title}</h3>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs text-muted"><Clock className="h-3.5 w-3.5" />{fmtDate(r.date)}</span>
                <Button size="sm" variant="soft" onClick={() => setActive(r)}><Play className="h-3.5 w-3.5" /> Watch</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={!!active} onClose={close} size="lg" title={active?.title} description={active ? `Recorded ${fmtDate(active.date)} · ${active.durationMin} min` : undefined}>
        {active && (
          <div className="overflow-hidden rounded-2xl bg-black">
            {failed ? (
              <div className="flex aspect-video flex-col items-center justify-center gap-3 p-6 text-center text-white">
                <MonitorPlay className="h-8 w-8 opacity-70" />
                <p className="text-sm">This recording couldn't be played in the browser.</p>
                <a href={active.videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold underline">Open in a new tab <ExternalLink className="h-3.5 w-3.5" /></a>
              </div>
            ) : (
              <video key={active.id} src={active.videoUrl} controls autoPlay playsInline className="aspect-video w-full" onError={() => setFailed(true)} />
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
