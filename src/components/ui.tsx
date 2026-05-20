"use client";

import { ButtonHTMLAttributes, forwardRef, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-[color:var(--color-accent)] text-white hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed",
  secondary:
    "bg-[color:var(--color-panel-2)] text-[color:var(--color-fg)] border border-[color:var(--color-border)] hover:border-[color:var(--color-accent)]/60",
  ghost:
    "bg-transparent text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)]",
  danger:
    "bg-[color:var(--color-danger)]/10 text-[color:var(--color-danger)] border border-[color:var(--color-danger)]/40 hover:bg-[color:var(--color-danger)]/15",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-[colors,transform] focus-ring active:scale-[0.98] disabled:active:scale-100",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    />
  );
});

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  variant?: "panel" | "panel-2";
}

export function Card({
  title,
  description,
  footer,
  children,
  variant = "panel",
  className,
  ...rest
}: CardProps) {
  return (
    <section className={cn(variant, "p-6 flex flex-col gap-4", className)} {...rest}>
      {(title || description) && (
        <header className="flex flex-col gap-1">
          {title && <h2 className="text-lg font-semibold tracking-tight">{title}</h2>}
          {description && (
            <p className="text-sm text-[color:var(--color-fg-muted)]">{description}</p>
          )}
        </header>
      )}
      <div className="flex flex-col gap-4">{children}</div>
      {footer && <footer className="pt-2">{footer}</footer>}
    </section>
  );
}

export function Pill({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: "default" | "warn" | "danger" | "ok";
  className?: string;
}) {
  const cls =
    tone === "warn"
      ? "pill pill-warn"
      : tone === "danger"
        ? "pill pill-danger"
        : tone === "ok"
          ? "pill pill-ok"
          : "pill";
  return <span className={cn(cls, className)}>{children}</span>;
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wider text-[color:var(--color-fg-muted)]">
        {label}
      </span>
      {children}
      {hint && <span className="text-xs text-[color:var(--color-fg-muted)]">{hint}</span>}
    </label>
  );
}

export function ProgressBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-1.5 w-full rounded-full bg-[color:var(--color-panel-2)] overflow-hidden">
      <div
        className="h-full bg-[color:var(--color-accent)] transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
