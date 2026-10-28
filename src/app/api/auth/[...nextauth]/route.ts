import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { connection, NextResponse } from "next/server";
import { authOptions, googleConfigured } from "@/lib/auth-options";

const handler = NextAuth(authOptions);

type Context = { params: Promise<{ nextauth: string[] }> };

async function route(request: NextRequest, context: Context) {
  await connection();
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL("/login?google=belum", request.url));
  }
  return handler(request, context);
}

export { route as GET, route as POST };
