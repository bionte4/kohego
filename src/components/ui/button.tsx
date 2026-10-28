import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-forest-800 text-white hover:bg-forest-900",
  secondary: "border border-slate-300 bg-white text-ink hover:border-forest-800/40",
  ghost: "text-forest-900 hover:bg-forest-50",
  danger: "bg-earth-800 text-white hover:bg-earth-900",
};

export function buttonClass(
  variant: keyof typeof variants = "primary",
  className?: string,
) {
  return cn(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-800/40 focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:cursor-not-allowed disabled:opacity-50",
    variants[variant],
    className,
  );
}

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
}) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}
