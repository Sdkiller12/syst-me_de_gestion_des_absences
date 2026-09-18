import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface BadgeProps {
  tone?: "green" | "red" | "orange" | "blue" | "purple" | "emerald" | "amber" | "slate" | "indigo";
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

const toneStyles = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200/80 dot:bg-emerald-500",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200/80 dot:bg-emerald-500",
  red: "bg-rose-50 text-rose-700 border-rose-200/80 dot:bg-rose-500",
  orange: "bg-amber-50 text-amber-700 border-amber-200/80 dot:bg-amber-500",
  amber: "bg-amber-50 text-amber-700 border-amber-200/80 dot:bg-amber-500",
  blue: "bg-blue-50 text-blue-700 border-blue-200/80 dot:bg-blue-500",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200/80 dot:bg-indigo-500",
  purple: "bg-purple-50 text-purple-700 border-purple-200/80 dot:bg-purple-500",
  slate: "bg-slate-100 text-slate-700 border-slate-200 dot:bg-slate-400",
};

const dotColors = {
  green: "bg-emerald-500",
  emerald: "bg-emerald-500",
  red: "bg-rose-500",
  orange: "bg-amber-500",
  amber: "bg-amber-500",
  blue: "bg-blue-500",
  indigo: "bg-indigo-500",
  purple: "bg-purple-500",
  slate: "bg-slate-400",
};

export function Badge({ tone = "slate", dot = true, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        toneStyles[tone],
        className
      )}
    >
      {dot ? <span className={cn("h-1.5 w-1.5 rounded-full shrink-0 animate-pulse", dotColors[tone])} /> : null}
      {children}
    </span>
  );
}
