import { useState } from "react";
import { Clock, ExternalLink, MonitorPlay, Play } from "lucide-react";
import { Button, Card, EmptyState } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/overlays";
import type { ClassRecording } from "@/types/student";
import { fmtDate } from "@/lib/utils";

const GRADS = ["from-indigo-500 to-violet-500", "from-teal-500 to-emerald-500", "from-sky-500 to-indigo-500", "from-fuchsia-500 to-purple-500"];

function getVideoEmbed(url: string): { type: "youtube" | "vimeo" | "video"; embedUrl: string } {
  if (!url) return { type: "video", embedUrl: "" };
  const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return {
      type: "youtube",
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0`,
    };
  }
  const vimeoMatch = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/i);
  if (vimeoMatch && vimeoMatch[1]) {
    return {
      type: "vimeo",
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`,
    };
  }
  return {
    type: "video",
    embedUrl: url,
  };
}

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
        {active && (() => {
          const embed = getVideoEmbed(active.videoUrl);
          return (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-2xl bg-black shadow-inner">
                {failed ? (
                  <div className="flex aspect-video flex-col items-center justify-center gap-3 p-6 text-center text-white">
                    <MonitorPlay className="h-8 w-8 opacity-70" />
                    <p className="text-sm">This recording couldn't be played directly in the browser.</p>
                    <a href={active.videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold underline text-primary">Open recording in a new tab <ExternalLink className="h-3.5 w-3.5" /></a>
                  </div>
                ) : embed.type === "youtube" || embed.type === "vimeo" ? (
                  <iframe
                    key={active.id}
                    src={embed.embedUrl}
                    title={active.title}
                    className="aspect-video w-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : (
                  <video
                    key={active.id}
                    src={embed.embedUrl}
                    controls
                    autoPlay
                    playsInline
                    className="aspect-video w-full"
                    onError={() => setFailed(true)}
                  />
                )}
              </div>
              <div className="flex items-center justify-between px-1 text-xs text-muted">
                <span>Format: {embed.type === "youtube" ? "YouTube Stream" : embed.type === "vimeo" ? "Vimeo Stream" : "Cloud Video Stream"}</span>
                <a
                  href={active.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                >
                  Open external player <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          );
        })()}
      </Modal>
    </>
  );
}
