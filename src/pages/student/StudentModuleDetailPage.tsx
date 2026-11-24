import { useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, BookOpen, CalendarDays, ClipboardList, Clock, FolderOpen, MapPin, MonitorPlay, Video } from "lucide-react";
import { Avatar, Badge, Button, Card, EmptyState, StatusBadge, Tabs } from "@/components/ui/primitives";
import { DataGate } from "@/components/student/states";
import { ModuleAssignments } from "@/components/student/module/ModuleAssignments";
import { ModuleCalendar } from "@/components/student/module/ModuleCalendar";
import { ModuleMaterials } from "@/components/student/module/ModuleMaterials";
import { ModuleRecordings } from "@/components/student/module/ModuleRecordings";
import { COLORS } from "@/components/analytics/chartParts";
import { useStudentData } from "@/hooks/useStudentData";

type TabId = "calendar" | "assignments" | "materials" | "recordings";
const TAB_IDS: TabId[] = ["calendar", "assignments", "materials", "recordings"];

export default function StudentModuleDetailPage() {
  const { moduleId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const { data, loading, error, reload } = useStudentData();

  const tab: TabId = TAB_IDS.includes(params.get("tab") as TabId) ? (params.get("tab") as TabId) : "calendar";
  const mod = data?.modules.find((m) => m.id === moduleId);
  const scoped = useMemo(() => {
    if (!data) return null;
    return {
      online: (data.onlineClasses || []).filter((c) => c.moduleId === moduleId),
      physical: (data.physicalClasses || []).filter((c) => c.moduleId === moduleId),
      assignments: (data.assignments || []).filter((a) => a.moduleId === moduleId),
      materials: (data.materials || []).filter((x) => x.moduleId === moduleId),
      recordings: (data.recordings || []).filter((r) => r.moduleId === moduleId),
    };
  }, [data, moduleId]);
  const color = data ? COLORS[Math.max(0, data.modules.findIndex((m) => m.id === moduleId)) % COLORS.length] : COLORS[0];

  return (
    <DataGate loading={loading} error={error} linked={data?.linked} data={data} onRetry={reload} cards={3}>
      {!mod || !scoped ? (
        <Card>
          <EmptyState icon={<BookOpen className="h-6 w-6" />} title="Module not found" text="This module doesn't exist or you aren't registered for it." action={<Link to="/student/modules"><Button variant="secondary"><ArrowLeft className="h-4 w-4" /> Back to my modules</Button></Link>} />
        </Card>
      ) : (
        <>
          <Link to="/student/modules" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> My modules</Link>

          <Card className="mb-6 overflow-hidden">
            <div className="h-2" style={{ background: color }} />
            <div className="flex flex-wrap items-start justify-between gap-5 p-5 sm:p-6">
              <div className="flex min-w-0 flex-1 items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg" style={{ background: color }}><BookOpen className="h-6 w-6" /></div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><Badge tone="primary">{mod.code}</Badge><StatusBadge status={mod.status} /></div>
                  <h1 className="mt-1.5 font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">{mod.name}</h1>
                  <p className="mt-1 max-w-2xl text-sm text-muted">{mod.description}</p>
                </div>
              </div>
              <div className="grid w-full gap-3 text-xs text-muted sm:w-auto sm:min-w-[260px]">
                {mod.teacher && (
                  <div className="flex items-center gap-2.5"><Avatar name={mod.teacher.fullName} size="sm" /><div className="leading-tight"><p className="text-sm font-semibold text-ink">{mod.teacher.fullName}</p><p>{mod.teacher.qualification}</p></div></div>
                )}
                <p className="flex items-center gap-2"><Video className="h-3.5 w-3.5 shrink-0" />{mod.onlineSchedule}</p>
                <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 shrink-0" />{mod.physicalSchedule}</p>
                <p className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 shrink-0" />Duration {mod.duration}</p>
              </div>
            </div>
          </Card>

          <Tabs<TabId>
            className="mb-5"
            value={tab}
            onChange={(t) => setParams({ tab: t }, { replace: true })}
            items={[
              { id: "calendar", label: "Class Calendar", icon: <CalendarDays className="h-4 w-4" /> },
              { id: "assignments", label: `Assignments (${scoped.assignments.length})`, icon: <ClipboardList className="h-4 w-4" /> },
              { id: "materials", label: `Study Materials (${scoped.materials.length})`, icon: <FolderOpen className="h-4 w-4" /> },
              { id: "recordings", label: `Recordings (${scoped.recordings.length})`, icon: <MonitorPlay className="h-4 w-4" /> },
            ]}
          />

          {tab === "calendar" && <ModuleCalendar online={scoped.online} physical={scoped.physical} />}
          {tab === "assignments" && <ModuleAssignments assignments={scoped.assignments} />}
          {tab === "materials" && <ModuleMaterials materials={scoped.materials} moduleName={mod.name} />}
          {tab === "recordings" && <ModuleRecordings recordings={scoped.recordings} />}
        </>
      )}
    </DataGate>
  );
}
