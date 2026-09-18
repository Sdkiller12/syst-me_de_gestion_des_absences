import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-slate-200/80 bg-white px-4 py-3 sm:px-6 rounded-b-2xl">
      <div className="text-xs text-slate-500 font-medium">
        Page <span className="font-bold text-slate-900">{page}</span> sur{" "}
        <span className="font-bold text-slate-900">{totalPages}</span>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={16} /> Précédent
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Suivant <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}
