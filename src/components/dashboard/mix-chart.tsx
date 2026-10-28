import { Card, CardTitle } from "@/components/ui/card";
import { formatIdr, formatPercent, formatVolume, formatWeight } from "@/lib/format";
import type { MixSlice } from "@/lib/metrics";

function ringSegments(slices: MixSlice[], circumference: number) {
  return slices.reduce<{
    cursor: number;
    segments: { slice: MixSlice; length: number; offset: number }[];
  }>(
    (acc, slice) => {
      const length = slice.share * circumference;
      return {
        cursor: acc.cursor + length,
        segments: [...acc.segments, { slice, length, offset: acc.cursor }],
      };
    },
    { cursor: 0, segments: [] },
  ).segments;
}

export function MixChart({ slices }: { slices: MixSlice[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.revenue, 0);
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const segments = ringSegments(slices, circumference);

  return (
    <Card className="h-full">
      <CardTitle>Komposisi produk</CardTitle>
      {total <= 0 ? (
        <p className="text-sm text-slate-500">Belum ada penjualan tercatat.</p>
      ) : (
        <div className="flex flex-col items-center gap-5 sm:flex-row">
          <svg
            viewBox="0 0 120 120"
            className="h-32 w-32 shrink-0"
            role="img"
            aria-label="Pembagian pendapatan per keluarga produk"
          >
            <circle cx="60" cy="60" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="14" />
            <g transform="rotate(-90 60 60)">
              {segments.map((segment) => (
                <circle
                  key={segment.slice.family}
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  stroke={segment.slice.color}
                  strokeWidth="14"
                  strokeDasharray={`${segment.length} ${circumference - segment.length}`}
                  strokeDashoffset={-segment.offset}
                />
              ))}
            </g>
          </svg>
          <ul className="w-full space-y-3">
            {slices.map((slice) => (
              <li key={slice.family} className="flex items-start justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 font-medium">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
                  <span className="truncate">{slice.label}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-semibold tabular-nums">{formatPercent(slice.share)}</span>
                  <span className="block text-xs text-slate-500 tabular-nums">
                    {slice.family === "poc" ? formatVolume(slice.liters) : formatWeight(slice.kilograms)} ·{" "}
                    {formatIdr(slice.revenue)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
