import { allowedActions } from "@/lib/rbac";
import { authorize } from "@/lib/session";

export async function GET() {
  const gate = await authorize("catalog", "read");
  if (!gate.ok) return gate.response;
  return Response.json({ role: gate.role, actions: allowedActions(gate.role, "catalog") });
}

export async function POST(request: Request) {
  const gate = await authorize("catalog", "create");
  if (!gate.ok) return gate.response;
  const { parseProductDraft } = await import("@/lib/crud-parse");
  const parsed = parseProductDraft(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ message: parsed.message }, { status: 400 });
  return Response.json({ ok: true, role: gate.role });
}

export async function PATCH(request: Request) {
  const gate = await authorize("catalog", "update");
  if (!gate.ok) return gate.response;
  const { parseId, parseProductDraft } = await import("@/lib/crud-parse");
  const body = await request.json().catch(() => null);
  const id = parseId(body);
  const draft = parseProductDraft(body);
  if (!id.ok) return Response.json({ message: id.message }, { status: 400 });
  if (!draft.ok) return Response.json({ message: draft.message }, { status: 400 });
  return Response.json({ ok: true, role: gate.role });
}

export async function DELETE(request: Request) {
  const gate = await authorize("catalog", "delete");
  if (!gate.ok) return gate.response;
  const { parseId } = await import("@/lib/crud-parse");
  const parsed = parseId(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ message: parsed.message }, { status: 400 });
  return Response.json({ ok: true, role: gate.role });
}
