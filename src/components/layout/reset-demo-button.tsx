"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { useStoreState } from "@/components/providers/store-provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

export function ResetDemoButton({ className, compact = false }: { className?: string; compact?: boolean }) {
  const store = useStoreState();
  const [open, setOpen] = useState(false);
  if (!store.ready) return null;
  const { resetDemo } = store;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={compact ? "Pulihkan data contoh" : undefined}
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-xl text-sm font-medium",
          className,
        )}
      >
        <RotateCcw className="h-4 w-4 shrink-0" aria-hidden />
        {compact ? <span className="sr-only">Pulihkan data contoh</span> : "Pulihkan data contoh"}
      </button>
      <Modal open={open} title="Pulihkan data contoh?" onClose={() => setOpen(false)}>
        <p className="text-sm leading-6 text-slate-600">
          Pesanan, stok, riwayat kiriman, dan mitra yang tersimpan di perangkat ini akan diganti
          dengan data contoh.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              resetDemo();
              setOpen(false);
            }}
          >
            Pulihkan
          </Button>
        </div>
      </Modal>
    </>
  );
}
