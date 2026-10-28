"use client";

import { cn } from "@/lib/utils";

interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  columns = "grid-cols-1 sm:grid-cols-3",
}: {
  label: string;
  value: T | "";
  options: ChoiceOption<T>[];
  onChange: (value: T) => void;
  columns?: string;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink">{label}</legend>
      <div className={cn("grid gap-2", columns)}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              disabled={option.disabled}
              onClick={() => onChange(option.value)}
              className={cn(
                "min-h-11 rounded-xl border px-3 py-2 text-left text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
                selected
                  ? "border-forest-800 bg-forest-50 text-forest-900 ring-2 ring-forest-800/20"
                  : "border-slate-300 bg-white text-ink hover:border-forest-800/40",
              )}
            >
              <span className="block">{option.label}</span>
              {option.hint ? (
                <span className="mt-0.5 block text-xs font-normal text-slate-500">{option.hint}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
