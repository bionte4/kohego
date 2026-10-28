"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="font-display text-3xl text-ink">Terjadi kendala</h1>
      <p className="mt-2 text-sm text-slate-500">Muat ulang bagian ini dan coba lagi.</p>
      <Button className="mt-6" onClick={reset}>
        Coba lagi
      </Button>
    </div>
  );
}
