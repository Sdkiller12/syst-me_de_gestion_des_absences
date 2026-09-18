import type { LucideIcon } from "lucide-react";

export interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  trend?: string;
  trendType?: "up" | "down" | "neutral";
  color?: "indigo" | "blue" | "emerald" | "amber" | "rose" | "purple" | "cyan";
}

const colorStyles = {
  indigo: {
    bg: "bg-indigo-50/80 text-indigo-600 border-indigo-100",
    glow: "group-hover:border-indigo-300",
    accent: "bg-indigo-600",
  },
  blue: {
    bg: "bg-blue-50/80 text-blue-600 border-blue-100",
    glow: "group-hover:border-blue-300",
    accent: "bg-blue-600",
  },
  emerald: {
    bg: "bg-emerald-50/80 text-emerald-600 border-emerald-100",
    glow: "group-hover:border-emerald-300",
    accent: "bg-emerald-600",
  },
  amber: {
    bg: "bg-amber-50/80 text-amber-600 border-amber-100",
    glow: "group-hover:border-amber-300",
    accent: "bg-amber-600",
  },
  rose: {
    bg: "bg-rose-50/80 text-rose-600 border-rose-100",
    glow: "group-hover:border-rose-300",
    accent: "bg-rose-600",
  },
  purple: {
    bg: "bg-purple-50/80 text-purple-600 border-purple-100",
    glow: "group-hover:border-purple-300",
    accent: "bg-purple-600",
  },
  cyan: {
    bg: "bg-cyan-50/80 text-cyan-600 border-cyan-100",
    glow: "group-hover:border-cyan-300",
    accent: "bg-cyan-600",
  },
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  color = "indigo",
}: StatCardProps) {
  const styles = colorStyles[color];

  return (
    <div className={`group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${styles.glow}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        {Icon ? (
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${styles.bg} transition-transform duration-200 group-hover:scale-110`}>
            <Icon size={20} />
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-2xl font-extrabold tracking-tight text-slate-900">{value}</p>
        {trend ? (
          <span className="inline-flex items-center text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
            {trend}
          </span>
        ) : null}
      </div>

      {hint ? <p className="mt-1 text-xs font-medium text-slate-500">{hint}</p> : null}

      <div className={`absolute bottom-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${styles.accent}`} />
    </div>
  );
}
