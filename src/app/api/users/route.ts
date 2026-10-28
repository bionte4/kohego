import { allowedActions } from "@/lib/rbac";
import { authorize } from "@/lib/session";
import { userFormSchema } from "@/lib/users";

function readId(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "";
  const id = (body as { id?: unknown }).id;
  return typeof id === "string" ? id.trim() : "";
}

export async function GET() {
  const gate = await authorize("users", "read");
  if (!gate.ok) return gate.response;
  return Response.json({ role: gate.role, actions: allowedActions(gate.role, "users") });
}

export async function POST(request: Request) {
  const gate = await authorize("users", "create");
  if (!gate.ok) return gate.response;
  const parsed = userFormSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ message: parsed.error.issues[0]?.message ?? "Data pengguna tidak valid." }, { status: 400 });
  }
  return Response.json({ ok: true, role: gate.role });
}

export async function PATCH(request: Request) {
  const gate = await authorize("users", "update");
  if (!gate.ok) return gate.response;
  const body = await request.json().catch(() => null);
  const id = readId(body);
  const parsed = userFormSchema.safeParse(body);
  if (!id) return Response.json({ message: "Id tidak ada." }, { status: 400 });
  if (!parsed.success) {
    return Response.json({ message: parsed.error.issues[0]?.message ?? "Data pengguna tidak valid." }, { status: 400 });
  }
  return Response.json({ ok: true, role: gate.role });
}

export async function DELETE(request: Request) {
  const gate = await authorize("users", "delete");
  if (!gate.ok) return gate.response;
  const id = readId(await request.json().catch(() => null));
  if (!id) return Response.json({ message: "Id tidak ada." }, { status: 400 });
  return Response.json({ ok: true, role: gate.role });
}
