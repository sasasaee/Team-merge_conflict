import type { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-accent/85",
  secondary: "border border-line text-text hover:border-muted",
  ghost: "text-muted hover:bg-surface-2 hover:text-text",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "px-3 py-1 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-sm",
};

// Class string for anything that should look like a button, including <a> links
export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return clsx(
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition disabled:opacity-40",
    VARIANT[variant],
    SIZE[size],
    className,
  );
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize };

export function Button({ variant = "primary", size = "md", className, type = "button", ...rest }: Props) {
  return <button type={type} className={buttonClass(variant, size, className)} {...rest} />;
}