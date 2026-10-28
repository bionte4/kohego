import { Prisma } from "@prisma/client";
import { connection } from "next/server";
import { parseOrderDraft } from "@/lib/crud-parse";
import { applyOrder } from "@/lib/mutations";
import { orderKilograms, orderRevenue } from "@/lib/order-math";
import { getDb } from "@/lib/social/db";
import { authorize } from "@/lib/session";
import { parseSalesBook } from "@/lib/storage";
import type { FastOrderReceipt } from "@/lib/types";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/**
 * Records a field order on the shared sales book.
 * applyOrder snapshots price and weight, removes packages from the chosen warehouse,
 * and writes a "jual" movement tied to the partner so the purchase shows in their history.
 */
export async function POST(request: Request) {
  await connection();
  const gate = await authorize("orders", "create");
  if (!gate.ok) return gate.response;

  const body = asRecord(await request.json().catch(() => null));
  const parsed = parseOrderDraft(body?.draft ?? body);
  if (!parsed.ok) return Response.json({ message: parsed.message }, { status: 400 });
  if (typeof body?.revision !== "number" || !Number.isInteger(body.revision)) {
    return Response.json({ message: "Revisi buku tidak ada." }, { status: 400 });
  }

  const db = getDb();
  if (!db) return Response.json({ message: "Database belum diatur.", offline: true }, { status: 503 });

  const current = await db.ledger.findUnique({ where: { key: "sales" } });
  const serverRevision = current?.revision ?? 0;
  if (body.revision !== serverRevision) {
    return Response.json(
      { message: "Buku penjualan berubah. Coba lagi.", revision: serverRevision, payload: current?.payload ?? null },
      { status: 409 },
    );
  }

  const book = parseSalesBook(body.book ?? current?.payload);
  if (!book) return Response.json({ message: "Buku penjualan tidak valid." }, { status: 400 });

  const result = applyOrder(book, parsed.value);
  if (!result.ok) return Response.json({ message: result.message }, { status: 400 });

  const payload = JSON.parse(JSON.stringify(result.data)) as Prisma.InputJsonValue;
  let revision = serverRevision + 1;
  try {
    if (!current) {
      const created = await db.ledger.create({ data: { key: "sales", revision: 1, payload } });
      revision = created.revision;
    } else {
      const saved = await db.ledger.updateMany({
        where: { key: "sales", revision: serverRevision },
        data: { revision: { increment: 1 }, payload },
      });
      if (saved.count === 0) {
        const latest = await db.ledger.findUnique({ where: { key: "sales" } });
        return Response.json(
          {
            message: "Buku penjualan berubah. Coba lagi.",
            revision: latest?.revision ?? serverRevision,
            payload: latest?.payload ?? null,
          },
          { status: 409 },
        );
      }
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const winner = await db.ledger.findUnique({ where: { key: "sales" } });
      return Response.json(
        { message: "Buku penjualan berubah. Coba lagi.", revision: winner?.revision ?? 1, payload: winner?.payload ?? null },
        { status: 409 },
      );
    }
    throw error;
  }

  const order = result.data.orders.find((item) => item.id === result.id);
  const receipt: FastOrderReceipt | null = order
    ? {
        id: order.id,
        code: order.code,
        partnerId: order.partnerId,
        warehouseId: order.warehouseId,
        payment: order.payment,
        totalIdr: orderRevenue(order),
        kilograms: orderKilograms(order),
        packages: order.lines.reduce((sum, line) => sum + line.qty, 0),
      }
    : null;

  return Response.json({
    ok: true,
    role: gate.role,
    revision,
    notice: result.notice,
    order: receipt,
    data: result.data,
  });
}
