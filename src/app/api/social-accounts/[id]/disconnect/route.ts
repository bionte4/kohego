import { connection } from "next/server";
import { disconnectSocialAccount } from "@/lib/social/accounts";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await context.params;
  try {
    const account = await disconnectSocialAccount(id);
    return Response.json(account);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memutus akun.";
    return Response.json({ message }, { status: 400 });
  }
}
