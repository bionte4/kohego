export function DashboardSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 className="text-xs font-semibold tracking-[0.14em] text-forest-800 uppercase">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
