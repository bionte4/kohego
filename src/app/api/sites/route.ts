import { allowedActions } from "@/lib/rbac";
import { authorize } from "@/lib/session";

export async function GET() {
  const gate = await authorize("sites", "read");
  if (!gate.ok) return gate.response;
  return Response.json({ role: gate.role, actions: allowedActions(gate.role, "sites") });
}

export async function POST(request: Request) {
  const gate = await authorize("sites", "create");
  if (!gate.ok) return gate.response;
  const { parseWarehouseDraft } = await import("@/lib/crud-parse");
  const parsed = parseWarehouseDraft(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ message: parsed.message }, { status: 400 });
  return Response.json({ ok: true, role: gate.role });
}

export async function PATCH(request: Request) {
  const gate = await authorize("sites", "update");
  if (!gate.ok) return gate.response;
  const { parseId, parseWarehouseDraft } = await import("@/lib/crud-parse");
  const body = await request.json().catch(() => null);
  const id = parseId(body);
  const draft = parseWarehouseDraft(body);
  if (!id.ok) return Response.json({ message: id.message }, { status: 400 });
  if (!draft.ok) return Response.json({ message: draft.message }, { status: 400 });
  return Response.json({ ok: true, role: gate.role });
}

export async function DELETE(request: Request) {
  const gate = await authorize("sites", "delete");
  if (!gate.ok) return gate.response;
  const { parseId } = await import("@/lib/crud-parse");
  const parsed = parseId(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ message: parsed.message }, { status: 400 });
  return Response.json({ ok: true, role: gate.role });
}
