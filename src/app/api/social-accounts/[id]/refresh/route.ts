import { connection } from "next/server";
import { refreshSocialAccount } from "@/lib/social/accounts";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await context.params;
  try {
    const account = await refreshSocialAccount(id);
    return Response.json(account);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memperbarui token.";
    return Response.json({ message }, { status: 400 });
  }
}
