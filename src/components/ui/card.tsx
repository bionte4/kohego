import Link from "next/link";
import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5", className)}>
      {children}
    </section>
  );
}

export function CardTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <h2 className="font-display text-xl leading-tight text-ink">{children}</h2>
      {action ? <div className="flex flex-wrap items-center gap-x-3">{action}</div> : null}
    </div>
  );
}

export function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center text-sm font-semibold text-forest-800">
      {children}
    </Link>
  );
}
