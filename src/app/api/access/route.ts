import { isCrudAction, isResource } from "@/lib/rbac";
import { authorize } from "@/lib/session";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { resource?: unknown; action?: unknown } | null;
  if (!isResource(body?.resource) || !isCrudAction(body?.action)) {
    return Response.json({ message: "Permintaan tidak valid." }, { status: 400 });
  }
  const gate = await authorize(body.resource, body.action);
  if (!gate.ok) return gate.response;
  return Response.json({ ok: true, role: gate.role });
}
