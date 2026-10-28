"use client";

import { MapPin } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useStore } from "@/components/providers/store-provider";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { Field, TextArea, TextInput } from "@/components/ui/field";
import { QtyStepper } from "@/components/ui/qty-stepper";
import { FAMILIES, emptyQuantities, productsByFamily } from "@/lib/catalog";
import { formatIdr, formatVolume, formatWeight } from "@/lib/format";
import { PARTNER_TYPE_LABEL, creditLabel, packageUnitLabel } from "@/lib/labels";
import { outstandingOf } from "@/lib/order-math";
import { stockQty } from "@/lib/stock";
import type { GeoTag, PaymentMethod, ProductFamilyId } from "@/lib/types";
import { cn } from "@/lib/utils";

export function OrderForm({ onCreated }: { onCreated?: (orderId: string) => void }) {
  const { partners, warehouses, stock, orders, placeOrder, products } = useStore();
  const [partnerId, setPartnerId] = useState("");
  const [picking, setPicking] = useState(true);
  const [query, setQuery] = useState("");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [family, setFamily] = useState<ProductFamilyId>("kambing");
  const [qty, setQty] = useState(() => emptyQuantities(products));
  const [address, setAddress] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("tunai");
  const [note, setNote] = useState("");
  const [geo, setGeo] = useState<GeoTag | null>(null);
  const [geoState, setGeoState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const partner = partners.find((item) => item.id === partnerId);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return partners;
    return partners.filter((item) =>
      [item.name, item.contactName, item.city, item.phone].join(" ").toLowerCase().includes(needle),
    );
  }, [partners, query]);

  const sized = productsByFamily(family, products);
  const active = FAMILIES.flatMap((item) => productsByFamily(item.id, products))
    .map((product) => ({ product, qty: qty[product.id] ?? 0 }))
    .filter((line) => line.qty > 0);
  const total = active.reduce((sum, line) => sum + line.qty * line.product.priceIdr, 0);
  const kilograms = active.reduce((sum, line) => sum + line.qty * line.product.weightKg, 0);
  const liters = active.reduce((sum, line) => sum + line.qty * line.product.volumeL, 0);
  const packages = active.reduce((sum, line) => sum + line.qty, 0);
  const room = partner ? partner.creditLimitIdr - outstandingOf(orders, partner.id) : 0;

  function selectPartner(id: string) {
    const next = partners.find((item) => item.id === id);
    setPartnerId(id);
    if (next) {
      setAddress(`${next.address}, ${next.city}`);
      if (next.creditTermsDays <= 0 && payment === "konsinyasi") setPayment("tunai");
    }
    setQuery("");
    setPicking(false);
  }

  function tagLocation() {
    if (!navigator.geolocation) {
      setGeoState("error");
      setGeoMessage("Perangkat ini tidak mendukung GPS.");
      return;
    }
    setGeoState("loading");
    setGeoMessage(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeo({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyM: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        });
        setGeoState("ready");
      },
      () => {
        setGeoState("error");
        setGeoMessage("Lokasi tidak dapat diambil. Izinkan akses lokasi, lalu coba lagi.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await placeOrder({
      partnerId,
      warehouseId,
      lines: FAMILIES.flatMap((item) => productsByFamily(item.id, products)).map((product) => ({
        variant: product.id,
        qty: qty[product.id] ?? 0,
      })),
      deliveryAddress: address,
      payment,
      geo,
      note,
    });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (result.id) onCreated?.(result.id);
    setError(null);
    setQty(emptyQuantities(products));
    setNote("");
    setGeo(null);
    setGeoState("idle");
    setGeoMessage(null);
    setPartnerId("");
    setAddress("");
    setPicking(true);
    setPayment("tunai");
  }

  return (
    <form onSubmit={onSubmit} className="pb-28 md:pb-0">
      <Card>
        <CardTitle>Pesanan baru</CardTitle>
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Mitra</p>
            {partner && !picking ? (
              <div className="flex items-start justify-between gap-3 rounded-2xl border border-forest-800 bg-forest-50 p-3">
                <div className="min-w-0">
                  <p className="font-semibold">{partner.name}</p>
                  <p className="text-sm text-slate-600">
                    {PARTNER_TYPE_LABEL[partner.type]} · {partner.city} · {creditLabel(partner.creditTermsDays)}
                  </p>
                </div>
                <Button variant="secondary" onClick={() => setPicking(true)}>
                  Ganti
                </Button>
              </div>
            ) : (
              <div>
                <TextInput
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari toko tani, poktan, kota, atau kontak"
                  aria-label="Cari mitra"
                  autoComplete="off"
                />
                <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                  {filtered.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => selectPartner(item.id)}
                        className="flex min-h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{item.name}</span>
                          <span className="block text-xs text-slate-500">
                            {PARTNER_TYPE_LABEL[item.type]} · {item.city}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {filtered.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">Tidak ada mitra yang cocok.</p>
                ) : null}
              </div>
            )}
          </div>

          <ChoiceGroup
            label="Gudang asal"
            value={warehouseId}
            onChange={setWarehouseId}
            options={warehouses.map((warehouse) => ({
              value: warehouse.id,
              label: warehouse.name,
              hint: warehouse.city,
            }))}
          />

          <ChoiceGroup
            label="Produk"
            value={family}
            onChange={setFamily}
            columns="grid-cols-2"
            options={FAMILIES.map((item) => {
              const count = productsByFamily(item.id, products).reduce((sum, product) => sum + (qty[product.id] ?? 0), 0);
              return {
                value: item.id,
                label: item.label,
                hint: count > 0 ? `${count} kemasan` : item.blurb,
              };
            })}
          />

          <div>
            <p className="mb-2 text-sm font-medium text-ink">Kemasan dan jumlah</p>
            <ul className="space-y-3">
              {sized.map((product) => {
                const onHand = stockQty(stock, warehouseId, product.id);
                const selectedQty = qty[product.id] ?? 0;
                const over = selectedQty > onHand;
                const unit = packageUnitLabel(product.unit);
                return (
                  <li
                    key={product.id}
                    className={cn(
                      "rounded-2xl border p-3",
                      selectedQty > 0 ? "border-forest-800 bg-forest-50/60" : "border-slate-200 bg-white",
                    )}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">
                          {product.shortLabel}
                          <span className="ml-2 text-xs font-normal text-slate-500">{product.role}</span>
                        </p>
                        <p className="text-sm text-slate-500">
                          {formatIdr(product.priceIdr)} / {unit} · stok {onHand} {unit}
                        </p>
                        {over ? <p className="text-sm text-red-700">Melebihi stok gudang ini.</p> : null}
                      </div>
                      <QtyStepper
                        label={product.label}
                        value={selectedQty}
                        onChange={(next) => setQty((current) => ({ ...current, [product.id]: next }))}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <Field label="Alamat pengiriman" hint="Bisa diubah jika kirim ke kebun, bukan ke toko.">
            <TextArea value={address} onChange={(event) => setAddress(event.target.value)} />
          </Field>

          <ChoiceGroup
            label="Pembayaran"
            value={payment}
            onChange={setPayment}
            columns="grid-cols-3"
            options={[
              { value: "tunai", label: "Tunai" },
              { value: "transfer", label: "Transfer" },
              {
                value: "konsinyasi",
                label: "Konsinyasi",
                disabled: !partner || partner.creditTermsDays <= 0,
                hint: !partner ? undefined : partner.creditTermsDays <= 0 ? "Tanpa tenor" : undefined,
              },
            ]}
          />
          {partner && payment === "konsinyasi" ? (
            <p className="text-sm text-slate-600">
              Sisa plafon {formatIdr(Math.max(0, room))} · tenor {partner.creditTermsDays} hari.
            </p>
          ) : null}

          <div className="rounded-2xl border border-dashed border-slate-300 p-3">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-forest-800" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium">Tag lokasi kunjungan</p>
                <p className="text-sm text-slate-500">Koordinat hanya disimpan di perangkat ini.</p>
                {geo ? (
                  <p className="mt-2 text-sm text-forest-900">
                    {geo.lat.toFixed(5)}, {geo.lng.toFixed(5)}
                    {geo.accuracyM != null ? ` · ±${Math.round(geo.accuracyM)} m` : ""}
                  </p>
                ) : null}
                {geoMessage ? <p className="mt-2 text-sm text-earth-800">{geoMessage}</p> : null}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={tagLocation} disabled={geoState === "loading"}>
                {geoState === "loading" ? "Mengambil lokasi..." : geo ? "Perbarui lokasi" : "Tandai lokasi"}
              </Button>
              {geo ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setGeo(null);
                    setGeoState("idle");
                  }}
                >
                  Hapus
                </Button>
              ) : null}
            </div>
          </div>

          <Field label="Catatan" hint="Opsional.">
            <TextArea value={note} maxLength={280} onChange={(event) => setNote(event.target.value)} />
          </Field>
        </div>
      </Card>

      <div
        className="fixed inset-x-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur md:static md:z-auto md:mt-4 md:border-0 md:bg-transparent md:px-0 md:py-0 md:shadow-none"
        style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}
      >
        {error ? (
          <p role="alert" className="mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        <div className="mx-auto flex w-full min-w-0 max-w-7xl items-center justify-between gap-3 md:max-w-none">
          <div className="min-w-0">
            <p className="truncate text-xs text-slate-500">
              {packages} kemasan
              {kilograms > 0 ? ` · ${formatWeight(kilograms)}` : ""}
              {liters > 0 ? ` · ${formatVolume(liters)}` : ""}
            </p>
            <p className="text-lg font-semibold tabular-nums">{formatIdr(total)}</p>
          </div>
          <Button type="submit" className="shrink-0">
            Simpan pesanan
          </Button>
        </div>
      </div>
    </form>
  );
}
