import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { accountByEmail, accountById, authenticate } from "@/lib/login-accounts";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import { isRole, type Role } from "@/lib/rbac";
import { openAtRest, sealAtRest } from "@/lib/social/crypto";
import { getDb } from "@/lib/social/db";

const GOOGLE_HASH = "google-oauth";

export interface CredentialInput {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  password?: string;
}

interface CredentialRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  passwordHash: string;
}

const FILE = path.join(process.cwd(), "data", "login-credentials.json");

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function readFileRows(): Promise<CredentialRow[]> {
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRow);
  } catch {
    return [];
  }
}

function isRow(value: unknown): value is CredentialRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<CredentialRow>;
  return typeof row.id === "string" && typeof row.email === "string" && typeof row.passwordHash === "string" && isRole(row.role) && typeof row.active === "boolean" && typeof row.name === "string";
}

async function writeFileRows(rows: CredentialRow[]) {
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(rows));
}

function opened(row: CredentialRow): CredentialRow {
  return { ...row, passwordHash: openAtRest(row.passwordHash) };
}

async function listRows(): Promise<CredentialRow[]> {
  const db = getDb();
  if (!db) return (await readFileRows()).map(opened);
  try {
    const rows = await db.loginCredential.findMany();
    return rows.flatMap((row) => {
      if (!isRole(row.role)) return [];
      return [opened({
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        active: row.active,
        passwordHash: row.passwordHash,
      })];
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") return (await readFileRows()).map(opened);
    throw error;
  }
}

export async function credentialById(id: string) {
  const row = (await listRows()).find((item) => item.id === id && item.active && item.passwordHash !== "revoked");
  if (!row) return null;
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

export async function pendingGoogleAccounts() {
  const rows = await listRows();
  return rows
    .filter((row) => !row.active && row.passwordHash === GOOGLE_HASH)
    .map((row) => ({ id: row.id, name: row.name, email: row.email, role: row.role, active: false }));
}

export async function linkGoogleAccount(input: { email: string; name: string }) {
  const email = normalizeEmail(input.email);
  const rows = await listRows();
  const row = rows.find((item) => item.email === email);
  if (row) {
    const person = { id: row.id, name: row.name, email: row.email, role: row.role };
    if (row.active && row.passwordHash !== "revoked") return { status: "ready" as const, ...person };
    return { status: "pending" as const, ...person };
  }
  const demo = accountByEmail(email);
  if (demo) return { status: "ready" as const, id: demo.id, name: demo.name, email: demo.email, role: demo.role };
  const id = `ggl_${createHash("sha256").update(email).digest("hex").slice(0, 20)}`;
  const name = input.name.trim() || email;
  await persist([...rows, { id, email, name, role: "FIELD_SALES", active: false, passwordHash: GOOGLE_HASH }]);
  return { status: "pending" as const, id, name, email, role: "FIELD_SALES" as const };
}

export async function credentialIds() {
  const rows = await listRows();
  const ready = new Set(rows.filter((row) => row.active && row.passwordHash.length > 20).map((row) => row.id));
  for (const id of ["usr-rina", "usr-agus", "usr-dewi", "usr-bambang"]) {
    if (!rows.some((row) => row.id === id)) ready.add(id);
  }
  return [...ready];
}

export async function saveCredential(input: CredentialInput): Promise<string | null> {
  const email = normalizeEmail(input.email);
  const password = input.password?.trim() ?? "";
  if (password && password.length < 8) return "Kata sandi minimal 8 karakter.";
  const rows = await listRows();
  const current = rows.find((row) => row.id === input.id) ?? rows.find((row) => row.email === email);
  const passwordHash = password ? hashPassword(password) : current?.passwordHash ?? "";
  if (!passwordHash) return null;
  if (rows.some((row) => row.email === email && row.id !== input.id)) return "Email ini sudah dipakai untuk masuk.";
  const next: CredentialRow = {
    id: input.id,
    email,
    name: input.name.trim(),
    role: input.role,
    active: input.active,
    passwordHash,
  };
  await persist([...rows.filter((row) => row.id !== next.id), next]);
  return null;
}

export async function removeCredential(id: string) {
  const rows = await listRows();
  const current = rows.find((row) => row.id === id);
  if (!current) {
    if (accountById(id)) await persist([...rows, { id, email: `${id}@revoked.local`, name: "", role: "FIELD_SALES", active: false, passwordHash: "revoked" }]);
    return;
  }
  await persist(rows.map((row) => (row.id === id ? { ...row, active: false, passwordHash: "revoked" } : row)));
}

function sealed(row: CredentialRow): CredentialRow {
  return { ...row, passwordHash: sealAtRest(row.passwordHash) };
}

async function persist(rows: CredentialRow[]) {
  const stored = rows.map(sealed);
  const db = getDb();
  if (!db) {
    await writeFileRows(stored);
    return;
  }
  try {
    await db.$transaction(async (tx) => {
      await tx.loginCredential.deleteMany();
      if (stored.length === 0) return;
      await tx.loginCredential.createMany({
        data: stored.map((row) => ({
          id: row.id,
          email: row.email,
          name: row.name || row.email,
          role: row.role,
          active: row.active,
          passwordHash: row.passwordHash,
        })),
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      await writeFileRows(stored);
      return;
    }
    throw error;
  }
}

export async function verifyLogin(email: string, password: string) {
  const needle = normalizeEmail(email);
  const row = (await listRows()).find((item) => item.email === needle);
  if (row) {
    if (!row.active || row.passwordHash === "revoked") return null;
    if (!verifyPassword(password, row.passwordHash)) return null;
    return { id: row.id, name: row.name, email: row.email, role: row.role };
  }
  return authenticate(email, password);
}
