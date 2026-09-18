import { Loader2 } from "lucide-react";

export function LoadingState({ label = "Chargement en cours…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-2xs">
        <Loader2 size={24} className="animate-spin" />
      </div>
      <p className="text-sm font-semibold text-slate-700">{label}</p>
    </div>
  );
}
