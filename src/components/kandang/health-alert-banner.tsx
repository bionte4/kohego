import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { healthAnomalies } from "@/lib/health-ops";
import { manureProjection, type LivestockBook } from "@/lib/livestock";
import { formatWeight } from "@/lib/format";

export function HealthAlertBanner({ book }: { book: LivestockBook }) {
  const alerts = healthAnomalies(book);
  if (alerts.length === 0) return null;
  const projection = manureProjection(book.animals);

  return (
    <section className="rounded-2xl border border-earth-800/20 bg-earth-100 px-4 py-4">
      <h2 className="font-display text-xl text-earth-900">Perlu perhatian dokter hewan</h2>
      <p className="mt-1 text-sm leading-6 text-earth-900">
        {alerts.length} ternak melewati ambang risiko. Perkiraan kohe harian tidak menghitung {formatWeight(projection.withheldKg)} dari ternak sakit atau karantina.
      </p>
      <ul className="mt-3 space-y-2">
        {alerts.map((alert) => (
          <li key={alert.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2">
            <span className="min-w-0">
              <Link href={alert.href} className="inline-flex min-h-11 items-center font-semibold text-ink">
                {alert.earTag}
              </Link>
              <span className="mt-0 block text-sm text-slate-600 sm:mt-0 sm:ml-2 sm:inline">
                {alert.label}. {alert.reason}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <Badge tone={alert.health === "sakit" ? "red" : alert.health === "karantina" ? "earth" : "amber"}>
                {alert.health === "sakit" ? "Sakit" : alert.health === "karantina" ? "Karantina" : "Pantau"}
              </Badge>
              <Link href={alert.href} className="inline-flex min-h-11 items-center text-sm font-semibold text-forest-800">
                Protokol
              </Link>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
