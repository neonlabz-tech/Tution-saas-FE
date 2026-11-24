import { BookOpen, CreditCard, LayoutDashboard } from "lucide-react";
import type { NavGroup } from "@/lib/nav";

export const STUDENT_HOME = "/student";

// Same NavGroup shape as the admin sidebar (src/lib/nav.ts).
export const STUDENT_NAV_GROUPS: NavGroup[] = [
  { label: "Main", items: [{ title: "Overview", route: STUDENT_HOME, icon: LayoutDashboard }] },
  {
    label: "Learning",
    items: [{ title: "My Modules", route: `${STUDENT_HOME}/modules`, icon: BookOpen }],
  },
  { label: "Account", items: [{ title: "Payments", route: `${STUDENT_HOME}/payments`, icon: CreditCard }] },
];

export const STUDENT_NAV = STUDENT_NAV_GROUPS.flatMap((g) => g.items);
