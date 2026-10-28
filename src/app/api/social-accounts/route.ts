import { connection } from "next/server";
import { listSocialAccounts, refreshExpiredAccounts } from "@/lib/social/accounts";

export async function GET() {
  await connection();
  const body = await listSocialAccounts();
  return Response.json(body);
}

export async function POST() {
  await connection();
  const body = await refreshExpiredAccounts();
  return Response.json(body);
}
