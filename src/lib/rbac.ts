export const ROLES = ["SUPER_ADMIN", "FARM_MANAGER", "FIELD_SALES", "WAREHOUSE_ADMIN"] as const;

export type Role = (typeof ROLES)[number];

export const RESOURCES = ["livestock", "inventory", "orders", "partners", "production", "users"] as const;

export type Resource = (typeof RESOURCES)[number];

export const CRUD_ACTIONS = ["create", "read", "update", "delete"] as const;

export type CrudAction = (typeof CRUD_ACTIONS)[number];

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super admin",
  FARM_MANAGER: "Manajer kandang",
  FIELD_SALES: "Penjualan lapangan",
  WAREHOUSE_ADMIN: "Admin gudang",
};

const RESOURCE_LABEL: Record<Resource, string> = {
  livestock: "ternak dan kohe",
  inventory: "inventori",
  orders: "pesanan",
  partners: "mitra",
  production: "produksi",
  users: "pengguna",
};

const ACTION_LABEL: Record<CrudAction, string> = {
  create: "membuat",
  read: "melihat",
  update: "mengubah",
  delete: "menghapus",
};

const ALL: readonly CrudAction[] = CRUD_ACTIONS;
const READ: readonly CrudAction[] = ["read"];

/**
 * FIELD_SALES writes orders and partners.
 * FARM_MANAGER writes the herd and fresh kohe.
 * WAREHOUSE_ADMIN writes packaged stock and conversion batches.
 * SUPER_ADMIN writes every resource.
 * Other roles may still read, so the dasbor and tables stay visible.
 */
const MATRIX: Record<Role, Record<Resource, readonly CrudAction[]>> = {
  SUPER_ADMIN: {
    livestock: ALL,
    inventory: ALL,
    orders: ALL,
    partners: ALL,
    production: ALL,
    users: ALL,
  },
  FARM_MANAGER: {
    livestock: ALL,
    inventory: READ,
    orders: READ,
    partners: READ,
    production: READ,
    users: READ,
  },
  FIELD_SALES: {
    livestock: READ,
    inventory: READ,
    orders: ALL,
    partners: ALL,
    production: READ,
    users: READ,
  },
  WAREHOUSE_ADMIN: {
    livestock: READ,
    inventory: ALL,
    orders: READ,
    partners: READ,
    production: ALL,
    users: READ,
  },
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function isResource(value: unknown): value is Resource {
  return typeof value === "string" && (RESOURCES as readonly string[]).includes(value);
}

export function isCrudAction(value: unknown): value is CrudAction {
  return typeof value === "string" && (CRUD_ACTIONS as readonly string[]).includes(value);
}

export function can(role: Role, resource: Resource, action: CrudAction) {
  return MATRIX[role][resource].includes(action);
}

export function allowedActions(role: Role, resource: Resource) {
  return MATRIX[role][resource];
}

export function denialMessage(role: Role, resource: Resource, action: CrudAction) {
  return `${ROLE_LABEL[role]} tidak dapat ${ACTION_LABEL[action]} ${RESOURCE_LABEL[resource]}.`;
}
