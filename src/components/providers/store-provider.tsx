"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  applyCancelOrder,
  applyOpname,
  applyOrder,
  applyPartner,
  applyProduct,
  applyProfile,
  applyReceipt,
  applyRemovePartner,
  applyRemoveProduct,
  applyRemoveWarehouse,
  applySettle,
  applyTransfer,
  applyUpdatePartner,
  applyUpdateProduct,
  applyUpdateWarehouse,
  applyWarehouse,
  applyWriteOff,
  type MutationResult,
} from "@/lib/mutations";
import { createSeed } from "@/lib/seed";
import { getClientSnapshot, getServerSnapshot, parseSalesBook, replaceState, subscribeStore } from "@/lib/storage";
import { guard } from "@/lib/guard";
import { ledgerRevision, rememberLedgerRevision } from "@/lib/ledger-sync";
import { can, denialMessage } from "@/lib/rbac";
import { getRoleClient } from "@/lib/role-store";
import type { ActionResult, AgentProfile, AppData, OpnameDraft, OrderDraft, PartnerDraft, ProductDraft, ReceiptDraft, TransferDraft, VariantId, WarehouseDraft } from "@/lib/types";

interface StoreActions {
  placeOrder: (draft: OrderDraft) => Promise<ActionResult>;
  receiveStock: (draft: ReceiptDraft) => Promise<ActionResult>;
  transferStock: (draft: TransferDraft) => Promise<ActionResult>;
  writeOffStock: (draft: { warehouseId: string; variant: VariantId; qty: number }) => Promise<ActionResult>;
  adjustOpname: (draft: OpnameDraft) => Promise<ActionResult>;
  addWarehouse: (draft: WarehouseDraft) => Promise<ActionResult>;
  updateWarehouse: (warehouseId: string, draft: WarehouseDraft) => Promise<ActionResult>;
  removeWarehouse: (warehouseId: string) => Promise<ActionResult>;
  addProduct: (draft: ProductDraft) => Promise<ActionResult>;
  updateProduct: (productId: string, draft: ProductDraft) => Promise<ActionResult>;
  removeProduct: (productId: string) => Promise<ActionResult>;
  addPartner: (draft: PartnerDraft) => Promise<ActionResult>;
  updatePartner: (partnerId: string, draft: PartnerDraft) => Promise<ActionResult>;
  removePartner: (partnerId: string) => Promise<ActionResult>;
  settleOrder: (orderId: string) => Promise<ActionResult>;
  cancelOrder: (orderId: string) => Promise<ActionResult>;
  updateProfile: (draft: AgentProfile) => ActionResult;
  resetDemo: () => void;
}

export type StoreApi = { ready: false } | ({ ready: true } & AppData & StoreActions);

const StoreContext = createContext<StoreApi | null>(null);

export function useStoreState(): StoreApi {
  const store = useContext(StoreContext);
  const hydrated = useSyncExternalStore(subscribeHydration, isHydrated, isHydratedOnServer);
  if (!store) {
    throw new Error("useStore harus dipakai di dalam data penjualan.");
  }
  if (!hydrated) return { ready: false };
  return store;
}

export function useStore() {
  const store = useStoreState();
  if (!store.ready) {
    throw new Error("Data penjualan belum siap.");
  }
  return store;
}

function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-md rounded-2xl bg-forest-950 px-4 py-3 text-sm text-white shadow-lg md:bottom-6 md:left-auto md:right-6"
    >
      {message}
    </div>
  );
}

const SAVE_FAILED = "Perubahan tidak tersimpan. Penyimpanan browser penuh atau diblokir.";

function subscribeHydration() {
  return () => {};
}

/** False on the server and during hydration, so the first paint matches the static shell. */
function isHydrated() {
  return true;
}

function isHydratedOnServer() {
  return false;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const data = useSyncExternalStore(subscribeStore, getClientSnapshot, getServerSnapshot);
  const hydrated = useSyncExternalStore(subscribeHydration, isHydrated, isHydratedOnServer);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const commitResult = useCallback((result: MutationResult): ActionResult => {
    if (!result.ok) return { ok: false, message: result.message };
    const saved = replaceState(result.data);
    setToast(saved ? result.notice : SAVE_FAILED);
    return { ok: true, id: result.id };
  }, []);

  const readyData = useCallback((): AppData | null => getClientSnapshot(), []);

  const placeOrder = useCallback(
    async (draft: OrderDraft): Promise<ActionResult> => {
      const role = getRoleClient();
      if (!role) return { ok: false, message: "Peran belum dimuat." };
      if (!can(role, "orders", "create")) return { ok: false, message: denialMessage(role, "orders", "create") };
      const current = readyData();
      if (!current) return { ok: false, message: "Data belum siap." };
      const applyLocal = () => commitResult(applyOrder(current, draft));
      try {
        const response = await fetch("/api/orders/fast", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ draft, revision: ledgerRevision("sales"), book: current }),
        });
        const body = (await response.json().catch(() => null)) as {
          message?: string;
          notice?: string;
          offline?: boolean;
          revision?: number;
          payload?: unknown;
          data?: unknown;
          order?: { id?: string };
        } | null;
        if (response.status === 503 || body?.offline) return applyLocal();
        if (response.status === 409) {
          const adopted = parseSalesBook(body?.payload);
          if (adopted && typeof body?.revision === "number") {
            replaceState(adopted, { quiet: true });
            rememberLedgerRevision("sales", body.revision);
          }
          return { ok: false, message: body?.message ?? "Buku penjualan berubah. Coba lagi." };
        }
        if (!response.ok || !body?.order?.id) return { ok: false, message: body?.message ?? "Pesanan tidak tersimpan." };
        const saved = parseSalesBook(body.data);
        if (!saved) return { ok: false, message: "Jawaban server tidak valid." };
        const stored = replaceState(saved, { quiet: true });
        if (typeof body.revision === "number") rememberLedgerRevision("sales", body.revision);
        setToast(stored ? (body.notice ?? "Pesanan tersimpan.") : SAVE_FAILED);
        return { ok: true, id: body.order.id };
      } catch {
        return applyLocal();
      }
    },
    [commitResult, readyData],
  );

  const receiveStock = useCallback(
    async (draft: ReceiptDraft): Promise<ActionResult> => {
      const denied = await guard("inventory", "create", draft);
      if (denied) return { ok: false, message: denied };
      const current = readyData();
      if (!current) return { ok: false, message: "Data belum siap." };
      return commitResult(applyReceipt(current, draft));
    },
    [commitResult, readyData],
  );

  const transferStock = useCallback(
    async (draft: TransferDraft): Promise<ActionResult> => {
      const denied = await guard("inventory", "update", draft);
      if (denied) return { ok: false, message: denied };
      const current = readyData();
      if (!current) return { ok: false, message: "Data belum siap." };
      return commitResult(applyTransfer(current, draft));
    },
    [commitResult, readyData],
  );

  const writeOffStock = useCallback(
    async (draft: { warehouseId: string; variant: VariantId; qty: number }): Promise<ActionResult> => {
      const denied = await guard("inventory", "delete", draft);
      if (denied) return { ok: false, message: denied };
      const current = readyData();
      if (!current) return { ok: false, message: "Data belum siap." };
      return commitResult(applyWriteOff(current, draft));
    },
    [commitResult, readyData],
  );

  const adjustOpname = useCallback(
    async (draft: OpnameDraft): Promise<ActionResult> => {
      const denied = await guard("inventory", "update", draft);
      if (denied) return { ok: false, message: denied };
      const current = readyData();
      if (!current) return { ok: false, message: "Data belum siap." };
      return commitResult(applyOpname(current, draft));
    },
    [commitResult, readyData],
  );

  const addWarehouse = useCallback(
    async (draft: WarehouseDraft): Promise<ActionResult> => {
      const denied = await guard("sites", "create", draft);
      if (denied) return { ok: false, message: denied };
      const current = readyData();
      if (!current) return { ok: false, message: "Data belum siap." };
      return commitResult(applyWarehouse(current, draft));
    },
    [commitResult, readyData],
  );

  const updateWarehouse = useCallback(
    async (warehouseId: string, draft: WarehouseDraft): Promise<ActionResult> => {
      const denied = await guard("sites", "update", { id: warehouseId, ...draft });
      if (denied) return { ok: false, message: denied };
      const current = readyData();
      if (!current) return { ok: false, message: "Data belum siap." };
      return commitResult(applyUpdateWarehouse(current, warehouseId, draft));
    },
    [commitResult, readyData],
  );

  const removeWarehouse = useCallback(
    async (warehouseId: string): Promise<ActionResult> => {
      const denied = await guard("sites", "delete", { id: warehouseId });
      if (denied) return { ok: false, message: denied };
      const current = readyData();
      if (!current) return { ok: false, message: "Data belum siap." };
      return commitResult(applyRemoveWarehouse(current, warehouseId));
    },
    [commitResult, readyData],
  );

  const addProduct = useCallback(
    async (draft: ProductDraft): Promise<ActionResult> => {
      const denied = await guard("catalog", "create", draft);
      if (denied) return { ok: false, message: denied };
      const current = readyData();
      if (!current) return { ok: false, message: "Data belum siap." };
      return commitResult(applyProduct(current, draft));
    },
    [commitResult, readyData],
  );

  const updateProduct = useCallback(
    async (productId: string, draft: ProductDraft): Promise<ActionResult> => {
      const denied = await guard("catalog", "update", { id: productId, ...draft });
      if (denied) return { ok: false, message: denied };
      const current = readyData();
      if (!current) return { ok: false, message: "Data belum siap." };
      return commitResult(applyUpdateProduct(current, productId, draft));
    },
    [commitResult, readyData],
  );

  const removeProduct = useCallback(
    async (productId: string): Promise<ActionResult> => {
      const denied = await guard("catalog", "delete", { id: productId });
      if (denied) return { ok: false, message: denied };
      const current = readyData();
      if (!current) return { ok: false, message: "Data belum siap." };
      return commitResult(applyRemoveProduct(current, productId));
    },
    [commitResult, readyData],
  );

  const addPartner = useCallback(
    async (draft: PartnerDraft): Promise<ActionResult> => {
      const denied = await guard("partners", "create", draft);
      if (denied) return { ok: false, message: denied };
      const current = readyData();
      if (!current) return { ok: false, message: "Data belum siap." };
      return commitResult(applyPartner(current, draft));
    },
    [commitResult, readyData],
  );

  const updatePartner = useCallback(
    async (partnerId: string, draft: PartnerDraft): Promise<ActionResult> => {
      const denied = await guard("partners", "update", { id: partnerId, ...draft });
      if (denied) return { ok: false, message: denied };
      const current = readyData();
      if (!current) return { ok: false, message: "Data belum siap." };
      return commitResult(applyUpdatePartner(current, partnerId, draft));
    },
    [commitResult, readyData],
  );

  const removePartner = useCallback(
    async (partnerId: string): Promise<ActionResult> => {
      const denied = await guard("partners", "delete", { id: partnerId });
      if (denied) return { ok: false, message: denied };
      const current = readyData();
      if (!current) return { ok: false, message: "Data belum siap." };
      return commitResult(applyRemovePartner(current, partnerId));
    },
    [commitResult, readyData],
  );

  const settleOrder = useCallback(
    async (orderId: string): Promise<ActionResult> => {
      const denied = await guard("orders", "update", { id: orderId });
      if (denied) return { ok: false, message: denied };
      const current = readyData();
      if (!current) return { ok: false, message: "Data belum siap." };
      return commitResult(applySettle(current, orderId));
    },
    [commitResult, readyData],
  );

  const cancelOrder = useCallback(
    async (orderId: string): Promise<ActionResult> => {
      const denied = await guard("orders", "delete", { id: orderId });
      if (denied) return { ok: false, message: denied };
      const current = readyData();
      if (!current) return { ok: false, message: "Data belum siap." };
      return commitResult(applyCancelOrder(current, orderId));
    },
    [commitResult, readyData],
  );

  const updateProfile = useCallback(
    (draft: AgentProfile): ActionResult => {
      const current = getClientSnapshot();
      if (!current) return { ok: false, message: "Data belum siap." };
      return commitResult(applyProfile(current, draft));
    },
    [commitResult],
  );

  const resetDemo = useCallback(() => {
    const saved = replaceState(createSeed());
    setToast(saved ? "Data contoh dipulihkan." : SAVE_FAILED);
  }, []);

  const api = useMemo<StoreApi>(() => {
    if (!hydrated || !data) return { ready: false };
    return {
      ready: true,
      ...data,
      placeOrder,
      receiveStock,
      transferStock,
      writeOffStock,
      adjustOpname,
      addWarehouse,
      updateWarehouse,
      removeWarehouse,
      addProduct,
      updateProduct,
      removeProduct,
      addPartner,
      updatePartner,
      removePartner,
      settleOrder,
      cancelOrder,
      updateProfile,
      resetDemo,
    };
  }, [
    hydrated,
    data,
    placeOrder,
    receiveStock,
    transferStock,
    writeOffStock,
    adjustOpname,
    addWarehouse,
    updateWarehouse,
    removeWarehouse,
    addProduct,
    updateProduct,
    removeProduct,
    addPartner,
    updatePartner,
    removePartner,
    settleOrder,
    cancelOrder,
    updateProfile,
    resetDemo,
  ]);

  return (
    <StoreContext.Provider value={api}>
      {children}
      <Toast message={toast} />
    </StoreContext.Provider>
  );
}
