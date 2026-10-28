import { allowedActions } from "@/lib/rbac";
import { authorize } from "@/lib/session";

export async function GET() {
  const gate = await authorize("inventory", "read");
  if (!gate.ok) return gate.response;
  return Response.json({ role: gate.role, actions: allowedActions(gate.role, "inventory") });
}

export async function POST(request: Request) {
  const gate = await authorize("inventory", "create");
  if (!gate.ok) return gate.response;
  const { parseReceipt } = await import("@/lib/crud-parse");
  const parsed = parseReceipt(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ message: parsed.message }, { status: 400 });
  return Response.json({ ok: true, role: gate.role });
}

export async function PATCH(request: Request) {
  const gate = await authorize("inventory", "update");
  if (!gate.ok) return gate.response;
  const { parseTransfer } = await import("@/lib/crud-parse");
  const parsed = parseTransfer(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ message: parsed.message }, { status: 400 });
  return Response.json({ ok: true, role: gate.role });
}

export async function DELETE(request: Request) {
  const gate = await authorize("inventory", "delete");
  if (!gate.ok) return gate.response;
  const { parseWriteOff } = await import("@/lib/crud-parse");
  const parsed = parseWriteOff(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ message: parsed.message }, { status: 400 });
  return Response.json({ ok: true, role: gate.role });
}
