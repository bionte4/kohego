import { cn } from "@/lib/utils";

export const controlClass =
  "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-ink outline-none transition placeholder:text-slate-400 focus:border-forest-800 focus:ring-2 focus:ring-forest-800/20";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(controlClass, props.className)} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(controlClass, "min-h-24 py-3", props.className)} />;
}
