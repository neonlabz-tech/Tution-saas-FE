import { Banknote, LayoutDashboard, Megaphone, Users } from "lucide-react";
import type { NavGroup } from "@/lib/nav";

export const TEACHER_HOME = "/teacher";

// Same NavGroup shape as the admin and student sidebars.
export const TEACHER_NAV_GROUPS: NavGroup[] = [
  { label: "Main", items: [{ title: "Overview", route: TEACHER_HOME, icon: LayoutDashboard }] },
  {
    label: "Teaching",
    items: [
      { title: "My Batches", route: `${TEACHER_HOME}/batches`, icon: Users },
      { title: "Notices", route: `${TEACHER_HOME}/notices`, icon: Megaphone },
    ],
  },
  { label: "Account", items: [{ title: "Payments", route: `${TEACHER_HOME}/payments`, icon: Banknote }] },
];
export const TEACHER_NAV = TEACHER_NAV_GROUPS.flatMap((g) => g.items);
