import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "./Button";

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50/50 p-8 text-center space-y-3 max-w-md mx-auto my-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
        <AlertCircle size={24} />
      </div>
      <p className="text-sm font-semibold text-rose-900">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-2 bg-white border-rose-200 text-rose-700 hover:bg-rose-50">
          <RotateCcw size={14} /> Réessayer
        </Button>
      ) : null}
    </div>
  );
}
