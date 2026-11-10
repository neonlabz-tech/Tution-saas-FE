import type { AttendanceRecord, Student, Transaction } from "@/types";
import type { Range } from "@/lib/period";
import { addDays, diffDays, parseISO, toISO } from "@/lib/utils";

export interface Bucket {
  key: string;
  label: string;
}
const monthLabel = (key: string) =>
  new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });

export function isDaily(r: Range) {
  return diffDays(r.from, r.to) + 1 <= 62;
}

export function buildBuckets(r: Range): Bucket[] {
  const span = diffDays(r.from, r.to) + 1;
  const out: Bucket[] = [];
  if (span <= 62) {
    for (let i = 0; i < span; i++) {
      const d = addDays(r.from, i);
      out.push({
        key: toISO(d),
        label: span <= 7 ? d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" }) : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      });
    }
  } else {
    const s = parseISO(r.from);
    const e = parseISO(r.to);
    const cur = new Date(s.getFullYear(), s.getMonth(), 1);
    while (cur <= e) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
      out.push({ key, label: monthLabel(key) });
      cur.setMonth(cur.getMonth() + 1);
    }
  }
  return out;
}
const keyOf = (date: string, daily: boolean) => (daily ? date : date.slice(0, 7));

export function financeSeries(tx: Transaction[], r: Range) {
  const daily = isDaily(r);
  const buckets = buildBuckets(r);
  const map = new Map(buckets.map((b) => [b.key, { label: b.label, income: 0, expense: 0, net: 0 }]));
  tx.forEach((t) => {
    const row = map.get(keyOf(t.date, daily));
    if (!row) return;
    if (t.type === "income") row.income += t.amount;
    else row.expense += t.amount;
    row.net = row.income - row.expense;
  });
  return [...map.values()];
}

export function enrollmentSeries(students: Student[], r: Range) {
  const daily = isDaily(r);
  const buckets = buildBuckets(r);
  const map = new Map(buckets.map((b) => [b.key, { label: b.label, added: 0, total: 0 }]));
  let base = students.filter((s) => s.enrollmentDate < r.from).length;
  students.forEach((s) => {
    const row = map.get(keyOf(s.enrollmentDate, daily));
    if (row) row.added += 1;
  });
  return [...map.values()].map((row) => {
    base += row.added;
    return { ...row, total: base };
  });
}

export const attendanceRate = (recs: AttendanceRecord[]) => {
  const counted = recs.filter((r) => r.status !== "excused");
  if (!counted.length) return 0;
  return Math.round((counted.filter((r) => r.status === "present" || r.status === "late").length / counted.length) * 1000) / 10;
};

export function attendanceCounts(recs: AttendanceRecord[]) {
  const c = { present: 0, absent: 0, late: 0, excused: 0 };
  recs.forEach((r) => (c[r.status] += 1));
  return c;
}

/** Attendance rate per recorded day, within range */
export function attendanceSeries(recs: AttendanceRecord[], r: Range) {
  const map = new Map<string, AttendanceRecord[]>();
  recs.forEach((rec) => {
    if (rec.date < r.from || rec.date > r.to) return;
    map.set(rec.date, [...(map.get(rec.date) ?? []), rec]);
  });
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => ({
      date,
      label: parseISO(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      rate: attendanceRate(list),
      ...attendanceCounts(list),
    }));
}

export function sumBy<T>(list: T[], f: (x: T) => number) {
  return list.reduce((s, x) => s + f(x), 0);
}

export function groupSum(tx: Transaction[]) {
  const m = new Map<string, number>();
  tx.forEach((t) => m.set(t.category, (m.get(t.category) ?? 0) + t.amount));
  return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}
