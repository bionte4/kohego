"use client";

import { ChevronLeft, MapPin, MessageCircle, Phone, Plus, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useCan } from "@/components/access/role-provider";
import { useStoreState } from "@/components/providers/store-provider";
import { OrderList } from "@/components/sales/order-list";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { Field, TextArea, TextInput, controlClass } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { formatDate, formatIdr, mapsHref, phoneHref, whatsappHref } from "@/lib/format";
import { CHANNEL_LABEL, PARTNER_TYPE_LABEL, creditLabel, partnerChannel } from "@/lib/labels";
import { partnerStats } from "@/lib/order-math";
import type { Partner, PartnerDraft, PartnerType } from "@/lib/types";
import { cn } from "@/lib/utils";

type TypeFilter = "all" | PartnerType;
type SortKey = "recent" | "value" | "name";

const emptyDraft = {
  name: "",
  type: "toko_tani" as PartnerType,
  contactName: "",
  phone: "",
  address: "",
  city: "",
  region: "",
  days: "0",
  limit: "0",
  lat: "",
  lng: "",
};

export function PartnerDirectory() {
  const store = useStoreState();
  const canCreate = useCan("partners", "create");
  const canUpdate = useCan("partners", "update");
  const canDelete = useCan("partners", "delete");
  const canSettle = useCan("orders", "update");
  const searchParams = useSearchParams();
  const router = useRouter();
  const requestedId = searchParams.get("id");
  const [selectedId, setSelectedId] = useState<string | null>(requestedId);
  const [seenRequest, setSeenRequest] = useState(requestedId);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  if (requestedId !== seenRequest) {
    setSeenRequest(requestedId);
    if (requestedId) setSelectedId(requestedId);
  }

  const stats = useMemo(() => {
    if (!store.ready) return new Map<string, ReturnType<typeof partnerStats>>();
    return new Map(store.partners.map((partner) => [partner.id, partnerStats(partner.id, store.orders)]));
  }, [store]);

  const visible = useMemo(() => {
    if (!store.ready) return [];
    const needle = query.trim().toLowerCase();
    const searched = store.partners.filter((partner) => {
      if (!needle) return true;
      return [partner.name, partner.contactName, partner.city, partner.region, partner.phone]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
    const typed = searched.filter((partner) => typeFilter === "all" || partner.type === typeFilter);
    return typed.slice().sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "id");
      if (sort === "value") return (stats.get(b.id)?.revenue ?? 0) - (stats.get(a.id)?.revenue ?? 0);
      const aTime = stats.get(a.id)?.lastAt ?? "";
      const bTime = stats.get(b.id)?.lastAt ?? "";
      if (!aTime && bTime) return 1;
      if (aTime && !bTime) return -1;
      if (aTime === bTime) return a.name.localeCompare(b.name, "id");
      return bTime.localeCompare(aTime);
    });
  }, [store, query, typeFilter, sort, stats]);

  if (!store.ready) {
    return <p className="text-sm text-slate-500">Menyiapkan data penjualan...</p>;
  }

  const selected = store.partners.find((partner) => partner.id === selectedId) ?? null;

  function closeDetail() {
    setSelectedId(null);
    if (requestedId) router.replace("/mitra");
  }

  const filters: { id: TypeFilter; label: string }[] = [
    { id: "all", label: "Semua" },
    { id: "toko_tani", label: "Toko Tani" },
    { id: "perkebunan", label: "Perkebunan" },
    { id: "urban", label: "Urban" },
  ];

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari mitra, kota, atau telepon"
              aria-label="Cari mitra"
              className={cn(controlClass, "pl-10")}
            />
          </div>
          <label className="block sm:w-48">
            <span className="sr-only">Urutkan</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className={controlClass}
            >
              <option value="recent">Terbaru</option>
              <option value="value">Nilai terbesar</option>
              <option value="name">Nama</option>
            </select>
          </label>
          {canCreate ? (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="shrink-0"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Mitra baru
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => {
            const count =
              filter.id === "all"
                ? store.partners.length
                : store.partners.filter((partner) => partner.type === filter.id).length;
            return (
              <button
                key={filter.id}
                type="button"
                aria-pressed={typeFilter === filter.id}
                onClick={() => setTypeFilter(filter.id)}
                className={cn(
                  "min-h-11 shrink-0 rounded-full px-4 text-sm font-medium",
                  typeFilter === filter.id ? "bg-forest-800 text-white" : "border border-slate-300 bg-white text-ink",
                )}
              >
                {filter.label}
                <span className="ml-1.5 text-xs opacity-80">{count}</span>
              </button>
            );
          })}
        </div>

        {visible.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
            Tidak ada mitra yang cocok.
          </p>
        ) : (
          <ul className="space-y-3">
            {visible.map((partner) => {
              const info = stats.get(partner.id);
              const active = partner.id === selected?.id;
              return (
                <li key={partner.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(partner.id)}
                    className={cn(
                      "w-full rounded-2xl border bg-white p-4 text-left shadow-sm",
                      active ? "border-forest-800 ring-2 ring-forest-800/20" : "border-slate-200",
                    )}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{partner.name}</span>
                        <span className="mt-1 block text-sm text-slate-500">
                          {partner.city}, {partner.region}
                        </span>
                      </span>
                      <Badge
                        tone={
                          partner.type === "perkebunan" ? "earth" : partner.type === "urban" ? "slate" : "forest"
                        }
                      >
                        {CHANNEL_LABEL[partnerChannel(partner.type)]} · {PARTNER_TYPE_LABEL[partner.type]}
                      </Badge>
                    </span>
                    <span className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <span>
                        <span className="block text-xs text-slate-500">Kontak</span>
                        {partner.contactName}
                      </span>
                      <span>
                        <span className="block text-xs text-slate-500">Tenor</span>
                        {creditLabel(partner.creditTermsDays)}
                      </span>
                      <span>
                        <span className="block text-xs text-slate-500">Total beli</span>
                        <span className="tabular-nums">{formatIdr(info?.revenue ?? 0)}</span>
                      </span>
                      <span>
                        <span className="block text-xs text-slate-500">Terakhir</span>
                        {info?.lastAt ? formatDate(info.lastAt) : "Belum ada"}
                      </span>
                    </span>
                    {(info?.outstanding ?? 0) > 0 ? (
                      <span className="mt-3 block text-sm font-medium text-earth-800">
                        Piutang {formatIdr(info?.outstanding ?? 0)}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div
        className={cn(
          selected
            ? "fixed inset-0 z-50 overflow-y-auto bg-paper p-4 pb-8 lg:static lg:z-auto lg:overflow-visible lg:bg-transparent lg:p-0"
            : "hidden lg:block",
        )}
      >
        {selected ? (
          <PartnerDetail
            partner={selected}
            onClose={closeDetail}
            orders={store.orders.filter((order) => order.partnerId === selected.id)}
            partners={store.partners}
            warehouses={store.warehouses}
            onSettle={
              canSettle
                ? (id) => {
                    void store.settleOrder(id);
                  }
                : undefined
            }
            onEdit={
              canUpdate
                ? () => {
                    setEditing(selected);
                    setFormOpen(true);
                  }
                : undefined
            }
            onDelete={
              canDelete
                ? () => {
                    void store.removePartner(selected.id).then((result) => {
                      if (result.ok) closeDetail();
                      else setFormError(result.message);
                    });
                  }
                : undefined
            }
            error={formError}
          />
        ) : (
          <Card className="hidden lg:block">
            <p className="text-sm leading-6 text-slate-500">
              Pilih mitra untuk melihat kontak, plafon, dan riwayat pembelian.
            </p>
          </Card>
        )}
      </div>

      {formOpen ? (
        <PartnerForm
          key={editing?.id ?? "baru"}
          partner={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSubmit={async (draft) => {
            const result = editing ? await store.updatePartner(editing.id, draft) : await store.addPartner(draft);
            if (result.ok) setSelectedId(result.id);
            return result;
          }}
        />
      ) : null}
    </div>
  );
}

function PartnerDetail({
  partner,
  orders,
  partners,
  warehouses,
  onClose,
  onSettle,
  onEdit,
  onDelete,
  error,
}: {
  partner: Partner;
  orders: import("@/lib/types").Order[];
  partners: Partner[];
  warehouses: import("@/lib/types").Warehouse[];
  onClose: () => void;
  onSettle?: (id: string) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  error?: string | null;
}) {
  const info = partnerStats(partner.id, orders);
  return (
    <div className="space-y-4 lg:sticky lg:top-24">
      <button
        type="button"
        onClick={onClose}
        className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-forest-800 lg:hidden"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Kembali ke daftar
      </button>
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl text-ink">{partner.name}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {partner.contactName} · {partner.phone}
            </p>
          </div>
          <button type="button" onClick={onClose} className="hidden text-sm font-medium text-slate-500 lg:inline-flex lg:min-h-11 lg:items-center">
            Tutup
          </button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <a className={buttonClass("secondary", "flex-col gap-1 px-2 text-xs")} href={phoneHref(partner.phone)}>
            <Phone className="h-4 w-4" aria-hidden />
            Telepon
          </a>
          <a
            className={buttonClass("secondary", "flex-col gap-1 px-2 text-xs")}
            href={whatsappHref(partner.phone)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            WhatsApp
          </a>
          <a
            className={buttonClass("secondary", "flex-col gap-1 px-2 text-xs")}
            href={mapsHref(partner.geo ? `${partner.geo.lat},${partner.geo.lng}` : `${partner.address}, ${partner.city}`)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MapPin className="h-4 w-4" aria-hidden />
            Peta
          </a>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          {partner.address}, {partner.city}, {partner.region}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {partner.geo ? `Koordinat ${partner.geo.lat}, ${partner.geo.lng}` : "Koordinat belum diisi."}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-slate-500">Tenor</dt>
            <dd className="font-medium">{creditLabel(partner.creditTermsDays)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Plafon</dt>
            <dd className="font-medium tabular-nums">
              {partner.creditLimitIdr > 0 ? formatIdr(partner.creditLimitIdr) : "Tidak ada"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Piutang</dt>
            <dd className="font-medium tabular-nums">{formatIdr(info.outstanding)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Total beli</dt>
            <dd className="font-medium tabular-nums">{formatIdr(info.revenue)}</dd>
          </div>
        </dl>
        {onEdit || onDelete ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {onEdit ? (
              <Button variant="secondary" onClick={onEdit}>
                Ubah
              </Button>
            ) : null}
            {onDelete ? (
              <Button variant="danger" onClick={onDelete}>
                Hapus
              </Button>
            ) : null}
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </Card>
      <section className="space-y-3">
        <h3 className="font-display text-xl text-ink">Riwayat pembelian</h3>
        <OrderList
          orders={orders}
          partners={partners}
          warehouses={warehouses}
          onSettle={onSettle}
          empty="Belum ada pembelian."
        />
      </section>
    </div>
  );
}

function PartnerForm({
  partner,
  onClose,
  onSubmit,
}: {
  partner: Partner | null;
  onClose: () => void;
  onSubmit: (draft: PartnerDraft) => Promise<{ ok: boolean; message?: string }>;
}) {
  const [draft, setDraft] = useState(
    partner
      ? {
          name: partner.name,
          type: partner.type,
          contactName: partner.contactName,
          phone: partner.phone,
          address: partner.address,
          city: partner.city,
          region: partner.region,
          days: String(partner.creditTermsDays),
          limit: String(partner.creditLimitIdr),
          lat: partner.geo ? String(partner.geo.lat) : "",
          lng: partner.geo ? String(partner.geo.lng) : "",
        }
      : emptyDraft,
  );
  const [error, setError] = useState<string | null>(null);

  function update(partial: Partial<typeof emptyDraft>) {
    setDraft((current) => ({ ...current, ...partial }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const result = await onSubmit({
      name: draft.name,
      type: draft.type,
      contactName: draft.contactName,
      phone: draft.phone,
      address: draft.address,
      city: draft.city,
      region: draft.region,
      creditTermsDays: Number.parseInt(draft.days || "0", 10),
      creditLimitIdr: Number.parseInt(draft.limit.replace(/[^\d]/g, "") || "0", 10),
      geo:
        draft.lat.trim() === "" && draft.lng.trim() === ""
          ? null
          : {
              lat: Number(draft.lat.replace(",", ".")),
              lng: Number(draft.lng.replace(",", ".")),
              accuracyM: null,
            },
    });
    if (!result.ok) {
      setError(result.message ?? "Mitra tidak dapat disimpan.");
      return;
    }
    setDraft(emptyDraft);
    setError(null);
    onClose();
  }

  return (
    <Modal
      open
      title={partner ? "Ubah mitra" : "Mitra baru"}
      onClose={() => {
        setError(null);
        onClose();
      }}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nama usaha">
          <TextInput value={draft.name} onChange={(event) => update({ name: event.target.value })} />
        </Field>
        <ChoiceGroup
          label="Jenis mitra"
          value={draft.type}
          onChange={(type) => update({ type })}
          options={[
            { value: "toko_tani", label: "Toko Tani", hint: "B2B" },
            { value: "perkebunan", label: "Perkebunan", hint: "B2B" },
            { value: "urban", label: "Urban Farmer", hint: "B2C" },
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama kontak">
            <TextInput value={draft.contactName} onChange={(event) => update({ contactName: event.target.value })} />
          </Field>
          <Field label="Telepon">
            <TextInput
              type="tel"
              inputMode="tel"
              value={draft.phone}
              onChange={(event) => update({ phone: event.target.value })}
            />
          </Field>
          <Field label="Kota">
            <TextInput value={draft.city} onChange={(event) => update({ city: event.target.value })} />
          </Field>
          <Field label="Wilayah">
            <TextInput
              value={draft.region}
              placeholder="Jawa Barat"
              onChange={(event) => update({ region: event.target.value })}
            />
          </Field>
        </div>
        <Field label="Alamat">
          <TextArea value={draft.address} onChange={(event) => update({ address: event.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tenor (hari)" hint="Isi 0 jika hanya tunai atau transfer.">
            <TextInput
              inputMode="numeric"
              value={draft.days}
              onChange={(event) => update({ days: event.target.value.replace(/[^\d]/g, "") })}
            />
          </Field>
          <Field label="Lintang" hint="Opsional. Isi bersama bujur.">
            <TextInput
              inputMode="decimal"
              value={draft.lat}
              placeholder="-6.816"
              onChange={(event) => update({ lat: event.target.value })}
            />
          </Field>
          <Field label="Bujur">
            <TextInput
              inputMode="decimal"
              value={draft.lng}
              placeholder="107.617"
              onChange={(event) => update({ lng: event.target.value })}
            />
          </Field>
          <Field label="Plafon konsinyasi (Rp)">
            <TextInput
              inputMode="numeric"
              value={draft.limit}
              onChange={(event) => update({ limit: event.target.value.replace(/[^\d]/g, "") })}
            />
          </Field>
        </div>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <Button type="submit" className="w-full">
          Simpan mitra
        </Button>
      </form>
    </Modal>
  );
}
