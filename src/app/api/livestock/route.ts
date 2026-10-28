import { allowedActions } from "@/lib/rbac";
import { authorize } from "@/lib/session";

export async function GET() {
  const gate = await authorize("livestock", "read");
  if (!gate.ok) return gate.response;
  return Response.json({ role: gate.role, actions: allowedActions(gate.role, "livestock") });
}

export async function POST(request: Request) {
  const gate = await authorize("livestock", "create");
  if (!gate.ok) return gate.response;
  const { parseAnimalDraft } = await import("@/lib/crud-parse");
  const body = await request.json().catch(() => null);
  const data = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (data && "capacity" in data && "location" in data && !("earTag" in data) && !("animalId" in data)) {
    const { parsePenDraft } = await import("@/lib/crud-parse");
    const parsed = parsePenDraft(body);
    if (!parsed.ok) return Response.json({ message: parsed.message }, { status: 400 });
    return Response.json({ ok: true, role: gate.role });
  }
  if (data && typeof data.animalId === "string" && "massKg" in data && !("earTag" in data)) {
    const massKg = Number(data.massKg);
    if (!data.animalId.trim() || !Number.isFinite(massKg)) {
      return Response.json({ message: "Catatan kohe tidak valid." }, { status: 400 });
    }
    return Response.json({ ok: true, role: gate.role });
  }
  const parsed = parseAnimalDraft(body);
  if (!parsed.ok) return Response.json({ message: parsed.message }, { status: 400 });
  return Response.json({ ok: true, role: gate.role });
}

export async function PATCH(request: Request) {
  const gate = await authorize("livestock", "update");
  if (!gate.ok) return gate.response;
  const body = await request.json().catch(() => null);
  const data = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (data && "earTag" in data) {
    const { parseAnimalDraft, parseId } = await import("@/lib/crud-parse");
    const id = parseId(body);
    const draft = parseAnimalDraft(body);
    if (!id.ok) return Response.json({ message: id.message }, { status: 400 });
    if (!draft.ok) return Response.json({ message: draft.message }, { status: 400 });
    return Response.json({ ok: true, role: gate.role });
  }
  const { parseAnimalPatch } = await import("@/lib/crud-parse");
  const parsed = parseAnimalPatch(body);
  if (!parsed.ok) return Response.json({ message: parsed.message }, { status: 400 });
  return Response.json({ ok: true, role: gate.role });
}

export async function DELETE(request: Request) {
  const gate = await authorize("livestock", "delete");
  if (!gate.ok) return gate.response;
  const { parseId } = await import("@/lib/crud-parse");
  const parsed = parseId(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ message: parsed.message }, { status: 400 });
  return Response.json({ ok: true, role: gate.role });
}
