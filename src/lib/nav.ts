import {
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  ScanLine,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  route: string;
  icon: LucideIcon;
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  { label: "Main", items: [{ title: "Overview", route: "/dashboard", icon: LayoutDashboard }] },
  {
    label: "Academics",
    items: [
      { title: "Students", route: "/dashboard/students", icon: GraduationCap },
      { title: "Teachers", route: "/dashboard/teachers", icon: Users },
      { title: "Modules", route: "/dashboard/modules", icon: BookOpen },
      { title: "Attendance", route: "/dashboard/attendance", icon: ClipboardCheck },
      { title: "Online Classes", route: "/dashboard/online-classes", icon: CalendarDays },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Income & Expenses", route: "/dashboard/finance", icon: Wallet },
      { title: "Notices", route: "/dashboard/notices", icon: Megaphone },
      { title: "QR Scanner", route: "/dashboard/qr-scanner", icon: ScanLine },
    ],
  },
  { label: "Insights", items: [{ title: "Analytics", route: "/dashboard/analytics", icon: ChartNoAxesCombined }] },
  { label: "System", items: [{ title: "Settings", route: "/dashboard/settings", icon: Settings }] },
];

export const ALL_NAV = NAV_GROUPS.flatMap((g) => g.items);
