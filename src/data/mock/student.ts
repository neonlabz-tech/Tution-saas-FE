// Mock content that only the Student Portal needs (physical classes, assignments, materials, recordings).
// Shape mirrors what a future API would return; module ids come from the shared admin mock (`./index`).
import type { Module, OnlineClass } from "@/types";
import type { Assignment, ClassRecording, MaterialFileType, PhysicalClass, StudyMaterial } from "@/types/student";
import { addDays, pad, toISO, toLocalDT } from "@/lib/utils";

export const hashStr = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const TOPICS: Record<string, string[]> = {
  mod_mth: ["Differentiation", "Integration", "Matrices & Determinants", "Complex Numbers"],
  mod_phy: ["Kinematics", "Waves & Optics", "Electricity", "Modern Physics"],
  mod_che: ["Organic Reactions", "Chemical Equilibrium", "Electrochemistry", "Titration Practicals"],
  mod_bio: ["Cell Biology", "Genetics", "Human Physiology", "Ecology"],
  mod_eng: ["Presentation Skills", "Formal Writing", "Group Discussion", "Interview Practice"],
  mod_ict: ["Algorithms", "SQL & Databases", "HTML & CSS", "Web Project"],
  mod_acc: ["Journal & Ledger", "Final Accounts", "Costing", "Cash Flow Statements"],
  mod_eco: ["Demand & Supply", "Elasticity", "National Income", "Inflation & Policy"],
};
const LOCATIONS = ["Hall A", "Physics Lab", "Chemistry Lab", "Room 204", "Language Lab", "Computer Lab 3", "Room 108", "Room 112"];
const PHYSICAL_HOURS = [9, 11, 14, 16];
const MATERIAL_KINDS: { label: string; type: MaterialFileType; desc: string }[] = [
  { label: "Lecture notes", type: "pdf", desc: "Complete lecture notes with worked examples." },
  { label: "Formula & summary sheet", type: "pdf", desc: "One-page quick-revision summary." },
  { label: "Past paper pack", type: "pdf", desc: "Recent past papers with marking schemes." },
  { label: "Practice data set", type: "csv", desc: "Spreadsheet-friendly practice data." },
  { label: "Reading list", type: "txt", desc: "Recommended books and online references." },
];
const SAMPLE_VIDEO = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

const topicsFor = (m: Module) => TOPICS[m.id] ?? ["Unit 1", "Unit 2", "Unit 3", "Unit 4"];

/** Weekend, on-site sessions (online classes run on weekdays in the shared mock, so they never collide). */
export function buildPhysicalClasses(modules: Module[]): PhysicalClass[] {
  const out: PhysicalClass[] = [];
  const now = toLocalDT(new Date());
  modules.forEach((m, mi) => {
    const dow = mi % 2 === 0 ? 6 : 0;
    const hour = PHYSICAL_HOURS[Math.floor(mi / 2) % PHYSICAL_HOURS.length];
    const topics = topicsFor(m);
    for (let d = -14; d <= 35; d++) {
      const day = addDays(new Date(), d);
      if (day.getDay() !== dow) continue;
      const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0);
      const end = new Date(start.getTime() + 120 * 60000);
      const s = toLocalDT(start);
      const e = toLocalDT(end);
      out.push({
        id: `phy_${m.id}_${toISO(day)}`,
        moduleId: m.id,
        title: `${m.name}: ${topics[Math.abs(d) % topics.length]} (on-site)`,
        start: s,
        end: e,
        location: LOCATIONS[mi % LOCATIONS.length],
        status: e < now ? "completed" : "scheduled",
      });
    }
  });
  return out;
}

const DUE_OFFSETS = [-21, -9, 5, 16];
export function buildAssignments(modules: Module[], studentKey: string): Assignment[] {
  const today = toISO(new Date());
  const out: Assignment[] = [];
  modules.forEach((m, mi) => {
    topicsFor(m).forEach((topic, i) => {
      const due = addDays(new Date(), DUE_OFFSETS[i] + (mi % 3));
      const dueDate = `${toISO(due)}T23:59`;
      const id = `asg_${m.id}_${i + 1}`;
      const h = hashStr(`${studentKey}:${id}`) % 100;
      const maxMarks = i === 3 ? 100 : 50;
      const base: Assignment = {
        id,
        moduleId: m.id,
        title: i === 3 ? `${topic}: Mini project` : `${topic}: ${i % 2 === 0 ? "Problem set" : "Worksheet"}`,
        description: `Complete the ${topic.toLowerCase()} exercises for ${m.name}. Submit your solution via Google Drive link or file upload.`,
        dueDate,
        status: "pending",
        fileUrl: `https://pub-f17818466e4646e8aae1bf24d363f534.r2.dev/assignments/${id}.pdf`,
        r2Key: `assignments/${id}.pdf`,
      };
      if (toISO(due) < today) {
        base.status = "overdue";
      } else {
        base.status = "pending";
      }
      out.push(base);
    });
  });
  return out;
}

export function buildMaterials(modules: Module[]): StudyMaterial[] {
  const out: StudyMaterial[] = [];
  modules.forEach((m) => {
    const topics = topicsFor(m);
    MATERIAL_KINDS.forEach((k, i) => {
      const h = hashStr(`${m.id}:${i}`);
      const topic = i < 2 ? topics[i % topics.length] : i === 2 ? "Term" : m.name;
      out.push({
        id: `mat_${m.id}_${i + 1}`,
        moduleId: m.id,
        name: `${m.code} · ${k.label}${i < 2 ? ` — ${topic}` : i === 2 ? "" : ""}`.trim(),
        description: k.desc,
        fileType: k.type,
        sizeKb: k.type === "pdf" ? 180 + (h % 2400) : k.type === "csv" ? 12 + (h % 90) : 2 + (h % 8),
        uploadedAt: toISO(addDays(new Date(), -(6 + i * 9 + (h % 5)))),
      });
    });
  });
  return out;
}

export function buildRecordings(classes: OnlineClass[]): ClassRecording[] {
  const now = toLocalDT(new Date());
  return classes
    .filter((c) => c.status === "completed" && c.end < now)
    .map((c) => ({
      id: `rec_${c.id}`,
      moduleId: c.moduleId,
      title: c.title,
      date: c.start.slice(0, 10),
      durationMin: 75 + (hashStr(c.id) % 30),
      videoUrl: SAMPLE_VIDEO,
    }));
}

/** "Saturday · 9:00 AM – 11:00 AM · Hall A" */
export function describePattern(items: { start: string; end: string }[], where?: string): string {
  if (!items.length) return "No sessions scheduled";
  const days = [...new Set(items.map((i) => new Date(`${i.start.slice(0, 10)}T00:00`).toLocaleDateString("en-US", { weekday: "short" })))];
  const t = (dt: string) => {
    const [h, m] = dt.slice(11, 16).split(":").map(Number);
    return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? "PM" : "AM"}`;
  };
  const first = items[0];
  return `${days.join(" & ")} · ${t(first.start)} – ${t(first.end)}${where ? ` · ${where}` : ""}`;
}
