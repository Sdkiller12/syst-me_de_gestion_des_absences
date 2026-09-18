import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../utils/cn";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost" | "gradient";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 rounded-xl focus:outline-hidden disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]";

  const sizes = {
    sm: "px-3 py-1.5 text-xs rounded-lg",
    md: "px-4 py-2.5 text-sm rounded-xl",
    lg: "px-6 py-3 text-base rounded-xl",
  };

  const variants = {
    primary:
      "bg-indigo-600 text-white shadow-xs hover:bg-indigo-700 hover:shadow-indigo-500/20 shadow-indigo-600/10",
    gradient:
      "bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 text-white shadow-xs hover:shadow-indigo-500/25 hover:opacity-95",
    secondary:
      "bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200/80 shadow-2xs",
    outline:
      "border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-400 shadow-2xs",
    danger:
      "bg-red-600 text-white shadow-xs hover:bg-red-700 hover:shadow-red-500/20",
    ghost:
      "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  };

  return (
    <button
      disabled={disabled || loading}
      className={cn(baseStyles, sizes[size], variants[variant], className)}
      {...props}
    >
      {loading ? <Loader2 size={16} className="animate-spin text-current" /> : null}
      {children}
    </button>
  );
}
