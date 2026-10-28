import { credentialIds, pendingGoogleAccounts, removeCredential, saveCredential } from "@/lib/credentials";
import { isRole, allowedActions } from "@/lib/rbac";
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
  const readyIds = await credentialIds();
  const pending = await pendingGoogleAccounts();
  return Response.json({ role: gate.role, actions: allowedActions(gate.role, "users"), readyIds, pending });
}

export async function POST(request: Request) {
  const gate = await authorize("users", "create");
  if (!gate.ok) return gate.response;
  const body = await request.json().catch(() => null);
  const id = readId(body);
  const parsed = userFormSchema.safeParse(body);
  if (!id) return Response.json({ message: "Id tidak ada." }, { status: 400 });
  if (!parsed.success) {
    return Response.json({ message: parsed.error.issues[0]?.message ?? "Data pengguna tidak valid." }, { status: 400 });
  }
  if (!parsed.data.password || parsed.data.password.length < 8) {
    return Response.json({ message: "Isi kata sandi, minimal 8 karakter." }, { status: 400 });
  }
  const saved = await saveCredential({ id, ...parsed.data, role: parsed.data.role });
  if (saved) return Response.json({ message: saved }, { status: 400 });
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
  if (!isRole(parsed.data.role)) return Response.json({ message: "Peran tidak dikenal." }, { status: 400 });
  const saved = await saveCredential({ id, ...parsed.data });
  if (saved) return Response.json({ message: saved }, { status: 400 });
  return Response.json({ ok: true, role: gate.role });
}

export async function DELETE(request: Request) {
  const gate = await authorize("users", "delete");
  if (!gate.ok) return gate.response;
  const id = readId(await request.json().catch(() => null));
  if (!id) return Response.json({ message: "Id tidak ada." }, { status: 400 });
  await removeCredential(id);
  return Response.json({ ok: true, role: gate.role });
}
