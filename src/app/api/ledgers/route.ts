import { Prisma } from "@prisma/client";
import { canWriteLedger, isLedgerKey, LEDGER_KEYS, type LedgerKey } from "@/lib/ledger";
import { parseLivestockBook } from "@/lib/livestock-store";
import { parsePublisherBook } from "@/lib/publisher-store";
import { getDb } from "@/lib/social/db";
import { parseSalesBook } from "@/lib/storage";
import { parseUsersBook } from "@/lib/users-store";
import { readSessionRole } from "@/lib/session";

function accept(key: LedgerKey, payload: unknown) {
  if (key === "sales") return parseSalesBook(payload);
  if (key === "livestock") return parseLivestockBook(payload);
  if (key === "publisher") return parsePublisherBook(payload);
  return parseUsersBook(payload);
}

export async function GET() {
  const role = await readSessionRole();
  const db = getDb();
  if (!db) return Response.json({ configured: false, role, ledgers: {} }, { status: 503 });
  const rows = await db.ledger.findMany();
  const ledgers: Partial<Record<LedgerKey, { revision: number; payload: unknown } | null>> = {};
  for (const key of LEDGER_KEYS) {
    const row = rows.find((item) => item.key === key);
    ledgers[key] = row ? { revision: row.revision, payload: row.payload } : null;
  }
  return Response.json({ configured: true, role, ledgers });
}

export async function PUT(request: Request) {
  const role = await readSessionRole();
  const db = getDb();
  if (!db) return Response.json({ message: "Database belum diatur." }, { status: 503 });
  const body = (await request.json().catch(() => null)) as { key?: unknown; revision?: unknown; payload?: unknown } | null;
  if (!isLedgerKey(body?.key) || typeof body.revision !== "number" || !Number.isInteger(body.revision)) {
    return Response.json({ message: "Buku tidak dikenal." }, { status: 400 });
  }
  if (!canWriteLedger(role, body.key)) {
    return Response.json({ message: "Peran ini tidak dapat menyimpan buku tersebut.", role }, { status: 403 });
  }
  const accepted = accept(body.key, body.payload);
  if (!accepted) return Response.json({ message: "Isi buku tidak valid." }, { status: 400 });
  const payload = JSON.parse(JSON.stringify(accepted)) as Prisma.InputJsonValue;

  const current = await db.ledger.findUnique({ where: { key: body.key } });
  if (!current) {
    if (body.revision !== 0) {
      return Response.json({ message: "Buku di server sudah berubah.", revision: 0, payload: null }, { status: 409 });
    }
    try {
      const created = await db.ledger.create({
        data: { key: body.key, revision: 1, payload },
      });
      return Response.json({ ok: true, revision: created.revision });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      const winner = await db.ledger.findUnique({ where: { key: body.key } });
      return Response.json(
        { message: "Buku di server sudah berubah.", revision: winner?.revision ?? 1, payload: winner?.payload ?? null },
        { status: 409 },
      );
    }
  }
  const saved = await db.ledger.updateMany({
    where: { key: body.key, revision: body.revision },
    data: { revision: { increment: 1 }, payload },
  });
  if (saved.count === 0) {
    const latest = await db.ledger.findUnique({ where: { key: body.key } });
    return Response.json(
      { message: "Buku di server sudah berubah.", revision: latest?.revision ?? current.revision, payload: latest?.payload ?? current.payload },
      { status: 409 },
    );
  }
  return Response.json({ ok: true, revision: body.revision + 1 });
}
