import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  gradient,
  color,
  spark,
  delta,
  deltaGoodWhenUp = true,
  sub,
  index = 0,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  gradient: string;
  color: string;
  spark?: number[];
  delta?: number;
  deltaGoodWhenUp?: boolean;
  sub?: string;
  index?: number;
}) {
  const id = `sp-${label.replace(/\W/g, "")}`;
  const good = delta === undefined ? true : deltaGoodWhenUp ? delta >= 0 : delta <= 0;
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05, duration: 0.4 }}>
      <Card className="group relative overflow-hidden p-5 transition hover:-translate-y-0.5 hover:shadow-pop">
        <div className="flex items-start justify-between">
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg", gradient)}>
            <Icon className="h-5 w-5" />
          </div>
          {delta !== undefined && (
            <span className={cn("inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold", good ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400")}>
              {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(delta)}%
            </span>
          )}
        </div>
        <p className="mt-4 text-xs font-medium text-muted">{label}</p>
        <p className="num mt-0.5 truncate text-[22px] font-bold leading-tight text-ink">{value}</p>
        {sub && <p className="mt-0.5 truncate text-[11px] text-muted">{sub}</p>}
        {spark && spark.length > 1 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 opacity-70">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark.map((v) => ({ v }))} margin={{ top: 4, bottom: 0, left: 0, right: 0 }}>
                <defs>
                  <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${id})`} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </motion.div>
  );
}
