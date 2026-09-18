import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export function Table({
  headers,
  children,
  className,
}: {
  headers: string[];
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs", className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-700">
          <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-bold uppercase tracking-wider text-slate-600">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="px-4 py-3.5">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {children}
          </tbody>
        </table>
      </div>
    </div>
  );
}
