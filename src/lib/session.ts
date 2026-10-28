import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
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

export interface SessionRecord {
  role: Role;
  userId: string;
}

export function roleSwitchAllowed() {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.KOHEGO_ALLOW_ROLE_SWITCH === "1";
}

function cookieKey(secret: string) {
  return createHash("sha256").update(secret).digest();
}

function sealToken(signed: string, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", cookieKey(secret), iv);
  const data = Buffer.concat([cipher.update(signed, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v3", iv.toString("base64url"), tag.toString("base64url"), data.toString("base64url")].join(".");
}

function openToken(token: string, secret: string) {
  const [version, ivPart, tagPart, dataPart] = token.split(".");
  if (version !== "v3" || !ivPart || !tagPart || !dataPart) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", cookieKey(secret), Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    const plain = Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]);
    return plain.toString("utf8");
  } catch {
    return null;
  }
}

function sign(role: Role, userId: string, key: string) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const body = `v2.${role}.${userId}.${exp}`;
  const mac = createHmac("sha256", key).update(body).digest("base64url");
  return sealToken(`${body}.${mac}`, key);
}

function verify(token: string | undefined, key: string | null): SessionRecord | null {
  if (!token || !key) return null;
  const signed = openToken(token, key);
  if (!signed) return null;
  const parts = signed.split(".");
  if (parts.length !== 5 || parts[0] !== "v2") return null;
  const [, role, userId, exp, mac] = parts;
  if (!isRole(role) || !userId || !/^[A-Za-z0-9_-]{1,80}$/.test(userId) || !exp || !mac) return null;
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < Math.floor(Date.now() / 1000)) return null;
  const expected = createHmac("sha256", key).update(`v2.${role}.${userId}.${exp}`).digest("base64url");
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  return { role, userId };
}

async function readGoogleSession(): Promise<SessionRecord | null> {
  if (!process.env.NEXTAUTH_SECRET?.trim()) return null;
  try {
    const { getServerSession } = await import("next-auth");
    const { authOptions } = await import("@/lib/auth-options");
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const role = session?.user?.role;
    if (!userId || !isRole(role) || !/^[A-Za-z0-9_-]{1,80}$/.test(userId)) return null;
    return { role, userId };
  } catch {
    return null;
  }
}

export async function readSession(): Promise<SessionRecord | null> {
  await connection();
  const jar = await cookies();
  return verify(jar.get(COOKIE)?.value, sessionSecret()) ?? (await readGoogleSession());
}

export async function readSessionRole(): Promise<Role | null> {
  return (await readSession())?.role ?? null;
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    secure: process.env.NODE_ENV === "production",
  };
}

export async function sessionJson(role: Role, userId: string, extra?: Record<string, unknown>) {
  await connection();
  const key = sessionSecret();
  const body = { role, label: ROLE_LABEL[role], ...extra };
  if (!key) return NextResponse.json({ message: "Rahasia sesi belum diatur." }, { status: 500 });
  const response = NextResponse.json(body);
  response.cookies.set(COOKIE, sign(role, userId, key), cookieOptions(MAX_AGE));
  return response;
}

export async function clearSession() {
  await connection();
  const response = NextResponse.json({ ok: true, role: null, user: null });
  response.cookies.set(COOKIE, "", cookieOptions(0));
  response.cookies.set("next-auth.session-token", "", cookieOptions(0));
  response.cookies.set("__Secure-next-auth.session-token", "", { ...cookieOptions(0), secure: true });
  return response;
}

export async function authorize(resource: Resource, action: CrudAction) {
  const role = await readSessionRole();
  if (!role) {
    return {
      ok: false as const,
      response: Response.json({ message: "Masuk diperlukan." }, { status: 401 }),
    };
  }
  if (can(role, resource, action)) return { ok: true as const, role };
  return {
    ok: false as const,
    response: Response.json({ message: denialMessage(role, resource, action), role }, { status: 403 }),
  };
}
