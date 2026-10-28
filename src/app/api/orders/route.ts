import { allowedActions } from "@/lib/rbac";
import { authorize } from "@/lib/session";

export async function GET() {
  const gate = await authorize("orders", "read");
  if (!gate.ok) return gate.response;
  return Response.json({ role: gate.role, actions: allowedActions(gate.role, "orders") });
}

export async function POST(request: Request) {
  const gate = await authorize("orders", "create");
  if (!gate.ok) return gate.response;
  const { parseOrderDraft } = await import("@/lib/crud-parse");
  const parsed = parseOrderDraft(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ message: parsed.message }, { status: 400 });
  return Response.json({ ok: true, role: gate.role });
}

export async function PATCH(request: Request) {
  const gate = await authorize("orders", "update");
  if (!gate.ok) return gate.response;
  const { parseId } = await import("@/lib/crud-parse");
  const parsed = parseId(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ message: parsed.message }, { status: 400 });
  return Response.json({ ok: true, role: gate.role });
}

export async function DELETE(request: Request) {
  const gate = await authorize("orders", "delete");
  if (!gate.ok) return gate.response;
  const { parseId } = await import("@/lib/crud-parse");
  const parsed = parseId(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ message: parsed.message }, { status: 400 });
  return Response.json({ ok: true, role: gate.role });
}
