"use client";

import { Printer, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { buttonClass } from "@/components/ui/button";
import { formatDateTime, formatIdr, formatVolume, formatWeight } from "@/lib/format";
import { buildInvoice, invoiceWhatsAppText, printInvoice, whatsAppShareUrl } from "@/lib/invoice";
import type { Order, Partner, Product, Warehouse } from "@/lib/types";

export function InvoiceModal({
  order,
  partner,
  warehouse,
  products,
  onClose,
}: {
  order: Order | null;
  partner: Partner | undefined;
  warehouse: Warehouse | undefined;
  products: Product[];
  onClose: () => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!order) return;
    const previous = document.activeElement;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [order]);

  if (!order) return null;

  const invoice = buildInvoice(order, partner, warehouse, products);
  const shareUrl = whatsAppShareUrl(invoice.partnerPhone, invoiceWhatsAppText(invoice));
  const mass = invoice.kilograms > 0 ? formatWeight(invoice.kilograms) : formatVolume(invoice.liters);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button type="button" aria-label="Tutup" className="absolute inset-0 bg-ink/40 print:hidden" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-paper p-4 shadow-xl outline-none sm:max-w-md sm:rounded-3xl"
      >
        <div className="mb-3 flex items-start justify-between gap-3 print:hidden">
          <h2 id={titleId} className="font-display text-2xl text-ink">
            Nota pengiriman
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <article id="nota-cetak" className="mx-auto bg-white px-4 py-5 text-ink shadow-sm">
          <header className="border-b border-dashed border-slate-300 pb-3 text-center">
            <p className="font-display text-2xl text-forest-800">Kohego</p>
            <p className="text-sm text-slate-600">Pupuk Organik</p>
            <p className="mt-3 text-xs uppercase tracking-wide text-slate-500">Nota pengiriman</p>
            <p className="mt-1 font-semibold">{invoice.code}</p>
            <p className="text-sm text-slate-600">{formatDateTime(invoice.createdAt)}</p>
          </header>

          <section className="border-b border-dashed border-slate-300 py-3 text-sm leading-6">
            <p className="font-semibold">{invoice.partnerName}</p>
            {invoice.partnerDetail ? <p className="text-slate-600">{invoice.partnerDetail}</p> : null}
            {invoice.partnerPhone ? <p className="text-slate-600">{invoice.partnerPhone}</p> : null}
            {invoice.partnerAddress ? <p className="text-slate-600">{invoice.partnerAddress}</p> : null}
            {invoice.warehouseName ? <p className="text-slate-500">Gudang asal: {invoice.warehouseName}</p> : null}
          </section>

          <table className="w-full border-b border-dashed border-slate-300 py-2 text-sm">
            <tbody>
              {invoice.lines.map((line) => (
                <tr key={`${line.name}-${line.qty}`} className="align-top">
                  <td className="py-1.5 pr-2">
                    <p className="font-medium">{line.name}</p>
                    <p className="text-xs text-slate-500">
                      {line.qty} {line.unit} × {formatIdr(line.unitPriceIdr)}
                      {line.kilograms > 0 ? ` · ${formatWeight(line.kilograms)}` : ""}
                      {line.liters > 0 ? ` · ${formatVolume(line.liters)}` : ""}
                    </p>
                  </td>
                  <td className="py-1.5 text-right font-medium tabular-nums">{formatIdr(line.lineTotalIdr)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <section className="space-y-1 py-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-600">Tonase</span>
              <span className="font-medium tabular-nums">{mass}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-base">
              <span className="font-semibold">Total</span>
              <span className="font-semibold tabular-nums text-forest-800">{formatIdr(invoice.totalIdr)}</span>
            </div>
            <p className="pt-2 font-medium text-earth-800">{invoice.paymentTerms}</p>
            {invoice.note ? <p className="text-slate-600">Catatan: {invoice.note}</p> : null}
          </section>

          <p className="border-t border-dashed border-slate-300 pt-3 text-center text-xs text-slate-500">
            Terima kasih. Simpan nota ini sebagai bukti pengiriman.
          </p>
        </article>

        <div className="mt-4 flex flex-col gap-2 print:hidden">
          <button type="button" className={buttonClass("primary", "w-full")} onClick={printInvoice}>
            <Printer className="h-4 w-4" aria-hidden />
            Cetak Nota
          </button>
          <a href={shareUrl} target="_blank" rel="noreferrer" className={buttonClass("secondary", "w-full")}>
            Bagikan via WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
