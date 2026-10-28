import { isRole, ROLE_LABEL } from "@/lib/rbac";
import { readSessionRole, roleSwitchAllowed, sessionJson } from "@/lib/session";

export async function GET() {
  const role = await readSessionRole();
  return Response.json({ role, label: ROLE_LABEL[role], switchable: roleSwitchAllowed() });
}

export async function POST(request: Request) {
  if (!roleSwitchAllowed()) {
    return Response.json({ message: "Pengganti peran dimatikan di lingkungan ini." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { role?: unknown } | null;
  if (!isRole(body?.role)) return Response.json({ message: "Peran tidak dikenal." }, { status: 400 });
  return sessionJson(body.role);
}
