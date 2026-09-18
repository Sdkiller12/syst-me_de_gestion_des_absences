import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export function Card({
  children,
  className,
  hoverable = false,
}: {
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all duration-200",
        hoverable && "hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5",
        className
      )}
    >
      {children}
    </div>
  );
}
