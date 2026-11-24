import { Download, FileSpreadsheet, FileText, FolderOpen } from "lucide-react";
import { Badge, Button, Card, EmptyState } from "@/components/ui/primitives";
import { DataTable, type Columns } from "@/components/ui/data-table";
import { useToast } from "@/components/ui/toast";
import { downloadMaterial } from "@/lib/studentFiles";
import type { StudyMaterial } from "@/types/student";
import { fmtDate } from "@/lib/utils";

const fmtSize = (kb: number) => (kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`);

export function ModuleMaterials({ materials, moduleName }: { materials: StudyMaterial[]; moduleName: string }) {
  const toast = useToast();
  const get = (m: StudyMaterial) => {
    try {
      downloadMaterial(m, moduleName);
      toast.success(`Downloading ${m.name}`);
    } catch {
      toast.error("Download failed. Please try again.");
    }
  };
  const columns: Columns<StudyMaterial> = [
    {
      accessorKey: "name",
      header: "Material",
      cell: ({ row: { original: m } }) => (
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-brand">{m.fileType === "csv" ? <FileSpreadsheet className="h-4 w-4" /> : <FileText className="h-4 w-4" />}</span>
          <div className="min-w-0">
            <p className="truncate font-semibold">{m.name}</p>
            <p className="truncate text-[11px] text-muted">{m.description}</p>
          </div>
        </div>
      ),
    },
    { accessorKey: "fileType", header: "Type", cell: ({ getValue }) => <Badge tone="neutral" className="uppercase">{getValue() as string}</Badge> },
    { accessorKey: "sizeKb", header: "Size", cell: ({ getValue }) => <span className="num text-xs">{fmtSize(getValue() as number)}</span> },
    { accessorKey: "uploadedAt", header: "Uploaded", cell: ({ getValue }) => <span className="text-xs text-muted">{fmtDate(getValue() as string)}</span> },
    { id: "actions", header: "", enableSorting: false, cell: ({ row }) => <Button size="sm" variant="soft" onClick={() => get(row.original)} aria-label={`Download ${row.original.name}`}><Download className="h-3.5 w-3.5" /> Download</Button> },
  ];
  return (
    <Card>
      {materials.length === 0 ? (
        <EmptyState icon={<FolderOpen className="h-6 w-6" />} title="No study materials yet" text="Notes, past papers and handouts will appear here once your teacher uploads them." />
      ) : (
        <DataTable data={materials} columns={columns} pageSize={8} emptyTitle="No materials" />
      )}
    </Card>
  );
}
