import { verifyLogin } from "@/lib/credentials";
import { loginBlockMessage, loginRateKey, noteLoginFailure, noteLoginSuccess } from "@/lib/login-rate";
import { ROLE_LABEL } from "@/lib/rbac";
import { sessionJson } from "@/lib/session";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const key = loginRateKey(request, email);
  const blocked = loginBlockMessage(key);
  if (blocked) return Response.json({ message: blocked }, { status: 429 });
  const account = await verifyLogin(email, password);
  if (!account) {
    noteLoginFailure(key);
    return Response.json({ message: "Email atau kata sandi salah." }, { status: 401 });
  }
  noteLoginSuccess(key);
  return sessionJson(account.role, account.id, {
    label: ROLE_LABEL[account.role],
    user: { id: account.id, name: account.name, email: account.email },
  });
}
