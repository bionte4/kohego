import { formatDateTime, formatIdr, formatVolume, formatWeight } from "@/lib/format";
import { PARTNER_TYPE_LABEL, PAYMENT_LABEL, packageUnitLabel } from "@/lib/labels";
import { orderKilograms, orderLiters, orderRevenue } from "@/lib/order-math";
import type { Order, Partner, PaymentMethod, Product, Warehouse } from "@/lib/types";

export interface InvoiceLineView {
  name: string;
  qty: number;
  unit: string;
  unitPriceIdr: number;
  lineTotalIdr: number;
  kilograms: number;
  liters: number;
}

export interface InvoiceView {
  code: string;
  createdAt: string;
  partnerName: string;
  partnerDetail: string;
  partnerPhone: string;
  partnerAddress: string;
  warehouseName: string;
  payment: PaymentMethod;
  paymentLabel: string;
  /** How the partner is expected to settle this delivery. */
  paymentTerms: string;
  lines: InvoiceLineView[];
  totalIdr: number;
  kilograms: number;
  liters: number;
  note: string;
}

export function buildInvoice(
  order: Order,
  partner: Partner | undefined,
  warehouse: Warehouse | undefined,
  products: Product[],
): InvoiceView {
  const lines = order.lines.map((line) => {
    const product = products.find((item) => item.id === line.variant);
    const unit = packageUnitLabel(product?.unit ?? "sak");
    return {
      name: product?.label ?? line.variant,
      qty: line.qty,
      unit,
      unitPriceIdr: line.unitPriceIdr,
      lineTotalIdr: line.qty * line.unitPriceIdr,
      kilograms: line.qty * line.weightKg,
      liters: line.qty * (line.volumeL ?? 0),
    };
  });
  const payment = order.payment;
  return {
    code: order.code,
    createdAt: order.createdAt,
    partnerName: partner?.name ?? "Mitra",
    partnerDetail: partner ? `${PARTNER_TYPE_LABEL[partner.type]} · ${partner.city}` : "",
    partnerPhone: partner?.phone ?? "",
    partnerAddress: order.deliveryAddress || (partner ? `${partner.address}, ${partner.city}` : ""),
    warehouseName: warehouse?.name ?? "",
    payment,
    paymentLabel: PAYMENT_LABEL[payment],
    paymentTerms: paymentTerms(payment, partner),
    lines,
    totalIdr: orderRevenue(order),
    kilograms: orderKilograms(order),
    liters: orderLiters(order),
    note: order.note,
  };
}

/** Cash is collected on delivery. Consignment follows the partner tenor. */
function paymentTerms(payment: PaymentMethod, partner: Partner | undefined) {
  if (payment === "konsinyasi") {
    const days = partner?.creditTermsDays ?? 0;
    return days > 0 ? `Konsinyasi, tempo ${days} hari.` : "Konsinyasi.";
  }
  if (payment === "transfer") return "Transfer, lunas saat pembayaran masuk.";
  return "Tunai, lunas saat barang diterima.";
}

export function invoiceWhatsAppText(invoice: InvoiceView) {
  const rows = invoice.lines
    .map((line) => {
      const mass = line.kilograms > 0 ? ` (${formatWeight(line.kilograms)})` : line.liters > 0 ? ` (${formatVolume(line.liters)})` : "";
      return `- ${line.name} × ${line.qty} ${line.unit}${mass} = ${formatIdr(line.lineTotalIdr)}`;
    })
    .join("\n");
  const mass = invoice.kilograms > 0 ? formatWeight(invoice.kilograms) : formatVolume(invoice.liters);
  return [
    "*Kohego — Pupuk Organik*",
    `Nota ${invoice.code}`,
    formatDateTime(invoice.createdAt),
    "",
    `Mitra: ${invoice.partnerName}`,
    invoice.partnerDetail,
    invoice.partnerPhone ? `Telp: ${invoice.partnerPhone}` : "",
    invoice.partnerAddress ? `Kirim: ${invoice.partnerAddress}` : "",
    invoice.warehouseName ? `Gudang: ${invoice.warehouseName}` : "",
    "",
    rows,
    "",
    `Total: ${formatIdr(invoice.totalIdr)}`,
    `Tonase: ${mass}`,
    `Pembayaran: ${invoice.paymentTerms}`,
    invoice.note ? `Catatan: ${invoice.note}` : "",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/** Indonesian mobiles stored as 08… become 62… for wa.me. */
export function whatsAppShareUrl(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  let normalized = digits;
  if (normalized.startsWith("0")) normalized = `62${normalized.slice(1)}`;
  else if (normalized.length > 0 && normalized.startsWith("8")) normalized = `62${normalized}`;
  const encoded = encodeURIComponent(text);
  if (!normalized) return `https://wa.me/?text=${encoded}`;
  return `https://wa.me/${normalized}?text=${encoded}`;
}

export function printInvoice() {
  window.print();
}
