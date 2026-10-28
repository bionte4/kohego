"use client";

export function QtyStepper({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
}) {
  function setQty(next: number) {
    if (!Number.isFinite(next)) {
      onChange(0);
      return;
    }
    onChange(Math.max(0, Math.min(9999, Math.floor(next))));
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={`Kurangi ${label}`}
        onClick={() => setQty(value - 1)}
        disabled={value <= 0}
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-lg text-ink disabled:opacity-40"
      >
        −
      </button>
      <input
        aria-label={`Jumlah ${label}`}
        inputMode="numeric"
        value={String(value)}
        onChange={(event) => {
          const digits = event.target.value.replace(/[^\d]/g, "");
          setQty(digits === "" ? 0 : Number.parseInt(digits, 10));
        }}
        className="h-11 w-16 rounded-xl border border-slate-300 bg-white text-center text-base font-semibold text-ink outline-none focus:border-forest-800 focus:ring-2 focus:ring-forest-800/20"
      />
      <button
        type="button"
        aria-label={`Tambah ${label}`}
        onClick={() => setQty(value + 1)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-lg text-ink"
      >
        +
      </button>
    </div>
  );
}
