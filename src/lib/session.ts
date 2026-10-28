import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { connection, NextResponse } from "next/server";
import {
  can,
  denialMessage,
  isRole,
  ROLE_LABEL,
  type CrudAction,
  type Resource,
  type Role,
} from "@/lib/rbac";

const COOKIE = "kohego_role";
const MAX_AGE = 60 * 60 * 24 * 30;

function sessionSecret() {
  const configured = process.env.ROLE_SESSION_SECRET?.trim() || process.env.TOKEN_ENCRYPTION_KEY?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") return null;
  return "kohego-dev-role-session";
}

function anonymousRole(): Role {
  return process.env.NODE_ENV === "production" ? "FIELD_SALES" : "SUPER_ADMIN";
}

export function roleSwitchAllowed() {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.KOHEGO_ALLOW_ROLE_SWITCH === "1";
}

function sign(role: Role, key: string) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const body = `${role}.${exp}`;
  const mac = createHmac("sha256", key).update(body).digest("base64url");
  return `${body}.${mac}`;
}

function verify(token: string | undefined, key: string | null): Role | null {
  if (!token || !key) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [role, exp, mac] = parts;
  if (!isRole(role) || !exp || !mac) return null;
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < Math.floor(Date.now() / 1000)) return null;
  const expected = createHmac("sha256", key).update(`${role}.${exp}`).digest("base64url");
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  return role;
}

export async function readSessionRole(): Promise<Role> {
  await connection();
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return anonymousRole();
  return verify(raw, sessionSecret()) ?? "FIELD_SALES";
}

export async function sessionJson(role: Role, extra?: Record<string, unknown>) {
  await connection();
  const key = sessionSecret();
  const body = { role, label: ROLE_LABEL[role], ...extra };
  if (!key) return NextResponse.json(body);
  const response = NextResponse.json(body);
  response.cookies.set(COOKIE, sign(role, key), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

export async function authorize(resource: Resource, action: CrudAction) {
  const role = await readSessionRole();
  if (can(role, resource, action)) return { ok: true as const, role };
  return {
    ok: false as const,
    response: Response.json({ message: denialMessage(role, resource, action), role }, { status: 403 }),
  };
}
