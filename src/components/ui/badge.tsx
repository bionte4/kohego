import { cn } from "@/lib/utils";

const tones = {
  forest: "bg-forest-50 text-forest-900",
  earth: "bg-earth-100 text-earth-900",
  slate: "bg-slate-100 text-slate-700",
  amber: "bg-amber-50 text-amber-900",
  red: "bg-red-50 text-red-800",
};

export function Badge({
  tone = "slate",
  children,
}: {
  tone?: keyof typeof tones;
  children: React.ReactNode;
}) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}
