import { credentialById } from "@/lib/credentials";
import { accountById } from "@/lib/login-accounts";
import { isRole, ROLE_LABEL } from "@/lib/rbac";
import { clearSession, readSession, roleSwitchAllowed, sessionJson } from "@/lib/session";

export async function GET() {
  const session = await readSession();
  const switchable = roleSwitchAllowed();
  if (!session) return Response.json({ role: null, user: null, switchable });
  const account = (await credentialById(session.userId)) ?? accountById(session.userId);
  return Response.json({
    role: session.role,
    label: ROLE_LABEL[session.role],
    switchable,
    user: account ? { id: account.id, name: account.name, email: account.email } : null,
  });
}

export async function POST(request: Request) {
  if (!roleSwitchAllowed()) {
    return Response.json({ message: "Pengganti peran dimatikan di lingkungan ini." }, { status: 403 });
  }
  const session = await readSession();
  if (!session) return Response.json({ message: "Masuk diperlukan." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { role?: unknown } | null;
  if (!isRole(body?.role)) return Response.json({ message: "Peran tidak dikenal." }, { status: 400 });
  const account = (await credentialById(session.userId)) ?? accountById(session.userId);
  return sessionJson(body.role, session.userId, {
    user: account ? { id: account.id, name: account.name, email: account.email } : null,
  });
}

export async function DELETE() {
  return clearSession();
}
