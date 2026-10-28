import type { Role } from "@/lib/rbac";
import { verifyPassword } from "@/lib/passwords";

export interface LoginAccount {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  passwordHash: string;
}

/** Demo staff. The shared password is Kohego2026. Sari stays inactive and cannot sign in. */
const ACCOUNTS: LoginAccount[] = [
  account("usr-rina", "Rina Kartika", "rina@kohego.local", "SUPER_ADMIN", true, "scrypt$rina$ixLdi6qIvfwSjjtsulvQ7mfrTllRseOzpq7Zd9vZGVU"),
  account("usr-agus", "Agus Salim", "agus@kohego.local", "FARM_MANAGER", true, "scrypt$agus$5S11kr29NYlXq6Lny6xukbBxP3Pip0zHTSWykVzNo9c"),
  account("usr-dewi", "Dewi Lestari", "dewi@kohego.local", "FIELD_SALES", true, "scrypt$dewi$5CxgwvGYxNl-DVAFfawXdXz5ouCGz20Wt00pyCA1Kyc"),
  account("usr-bambang", "Bambang Wijaya", "bambang@kohego.local", "WAREHOUSE_ADMIN", true, "scrypt$bambang$5ZIGs_HGPwicjhFCdWRP1S-ww8GrBjkpV_IBoJdvY74"),
];

function account(
  id: string,
  name: string,
  email: string,
  role: Role,
  active: boolean,
  passwordHash: string,
): LoginAccount {
  return { id, name, email, role, active, passwordHash };
}

export function authenticate(email: string, password: string) {
  const account = ACCOUNTS.find((item) => item.email === email.trim().toLowerCase());
  if (!account || !account.active) return null;
  if (!verifyPassword(password, account.passwordHash)) return null;
  return publicAccount(account);
}

export function accountById(id: string) {
  const account = ACCOUNTS.find((item) => item.id === id && item.active);
  return account ? publicAccount(account) : null;
}

export function accountByEmail(email: string) {
  const account = ACCOUNTS.find((item) => item.email === email.trim().toLowerCase() && item.active);
  return account ? publicAccount(account) : null;
}

function publicAccount(account: LoginAccount) {
  return { id: account.id, name: account.name, email: account.email, role: account.role };
}
