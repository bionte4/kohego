import { z } from "zod";
import { ROLES, type Role } from "@/lib/rbac";

export const userFormSchema = z
  .object({
    name: z.string().trim().min(2, "Isi nama, minimal 2 karakter.").max(80, "Nama paling panjang 80 karakter."),
    email: z.string().trim().email("Email tidak valid.").max(120, "Email paling panjang 120 karakter."),
    role: z.enum(ROLES),
    active: z.boolean(),
    password: z.string().trim().max(80, "Kata sandi paling panjang 80 karakter.").optional(),
  })
  .superRefine((value, ctx) => {
    const password = value.password?.trim() ?? "";
    if (password && password.length < 8) {
      ctx.addIssue({ code: "custom", path: ["password"], message: "Kata sandi minimal 8 karakter." });
    }
  });

export type UserFormValues = z.infer<typeof userFormSchema>;

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  updatedAt: string;
}

export interface StaffDirectory {
  version: 1;
  users: StaffUser[];
}

export type UserResult =
  | { ok: true; id: string; directory: StaffDirectory }
  | { ok: false; message: string };

const LAST_ADMIN = "Sisakan minimal satu super admin yang aktif.";

export function createUserSeed(): StaffDirectory {
  return {
    version: 1,
    users: [
      staff("usr-rina", "Rina Kartika", "rina@kohego.local", "SUPER_ADMIN", true),
      staff("usr-agus", "Agus Salim", "agus@kohego.local", "FARM_MANAGER", true),
      staff("usr-dewi", "Dewi Lestari", "dewi@kohego.local", "FIELD_SALES", true),
      staff("usr-bambang", "Bambang Wijaya", "bambang@kohego.local", "WAREHOUSE_ADMIN", true),
      staff("usr-sari", "Sari Wulandari", "sari@kohego.local", "FIELD_SALES", false),
    ],
  };
}

function staff(id: string, name: string, email: string, role: Role, active: boolean): StaffUser {
  return { id, name, email, role, active, updatedAt: "2026-10-28T08:00:00.000Z" };
}

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Data pengguna tidak valid.";
}

function normalize(values: UserFormValues): Omit<StaffUser, "id" | "updatedAt"> {
  return {
    name: values.name.trim(),
    email: values.email.trim().toLowerCase(),
    role: values.role,
    active: values.active,
  };
}

function emailTaken(users: StaffUser[], email: string, exceptId?: string) {
  return users.some((user) => user.id !== exceptId && user.email.toLowerCase() === email);
}

function keepsAnAdmin(users: StaffUser[]) {
  return users.some((user) => user.role === "SUPER_ADMIN" && user.active);
}

export function addUser(directory: StaffDirectory, draft: UserFormValues, id: string, nowIso: string): UserResult {
  const parsed = userFormSchema.safeParse(draft);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  const next = normalize(parsed.data);
  if (emailTaken(directory.users, next.email)) return { ok: false, message: "Email ini sudah dipakai." };
  const user: StaffUser = { id, ...next, updatedAt: nowIso };
  return { ok: true, id, directory: { ...directory, users: [user, ...directory.users] } };
}

export function updateUser(directory: StaffDirectory, userId: string, draft: UserFormValues, nowIso: string): UserResult {
  const current = directory.users.find((user) => user.id === userId);
  if (!current) return { ok: false, message: "Pengguna tidak ditemukan." };
  const parsed = userFormSchema.safeParse(draft);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  const next = normalize(parsed.data);
  if (emailTaken(directory.users, next.email, current.id)) return { ok: false, message: "Email ini sudah dipakai." };
  const users = directory.users.map((user) => (user.id === current.id ? { ...user, ...next, updatedAt: nowIso } : user));
  if (!keepsAnAdmin(users)) return { ok: false, message: LAST_ADMIN };
  return { ok: true, id: current.id, directory: { ...directory, users } };
}

export function removeUser(directory: StaffDirectory, userId: string): UserResult {
  const current = directory.users.find((user) => user.id === userId);
  if (!current) return { ok: false, message: "Pengguna tidak ditemukan." };
  const users = directory.users.filter((user) => user.id !== current.id);
  if (!keepsAnAdmin(users)) return { ok: false, message: LAST_ADMIN };
  return { ok: true, id: current.id, directory: { ...directory, users } };
}

export function activeAdminCount(users: StaffUser[]) {
  return users.filter((user) => user.role === "SUPER_ADMIN" && user.active).length;
}
