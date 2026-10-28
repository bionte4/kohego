import { allowedActions } from "@/lib/rbac";
import { authorize } from "@/lib/session";

export async function GET() {
  const gate = await authorize("partners", "read");
  if (!gate.ok) return gate.response;
  return Response.json({ role: gate.role, actions: allowedActions(gate.role, "partners") });
}

export async function POST(request: Request) {
  const gate = await authorize("partners", "create");
  if (!gate.ok) return gate.response;
  const { parsePartnerDraft } = await import("@/lib/crud-parse");
  const parsed = parsePartnerDraft(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ message: parsed.message }, { status: 400 });
  return Response.json({ ok: true, role: gate.role });
}

export async function PATCH(request: Request) {
  const gate = await authorize("partners", "update");
  if (!gate.ok) return gate.response;
  const { parseId, parsePartnerDraft } = await import("@/lib/crud-parse");
  const body = await request.json().catch(() => null);
  const id = parseId(body);
  const draft = parsePartnerDraft(body);
  if (!id.ok) return Response.json({ message: id.message }, { status: 400 });
  if (!draft.ok) return Response.json({ message: draft.message }, { status: 400 });
  return Response.json({ ok: true, role: gate.role });
}

export async function DELETE(request: Request) {
  const gate = await authorize("partners", "delete");
  if (!gate.ok) return gate.response;
  const { parseId } = await import("@/lib/crud-parse");
  const parsed = parseId(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ message: parsed.message }, { status: 400 });
  return Response.json({ ok: true, role: gate.role });
}
