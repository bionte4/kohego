import { Badge } from "@/components/ui/badge";
import { ROLE_LABEL, type Role } from "@/lib/rbac";

const tones = {
  SUPER_ADMIN: "forest",
  FARM_MANAGER: "earth",
  FARM_KEEPER: "amber",
  FIELD_SALES: "amber",
  WAREHOUSE_ADMIN: "slate",
} as const;

export function RoleBadge({ role }: { role: Role }) {
  return <Badge tone={tones[role]}>{ROLE_LABEL[role]}</Badge>;
}

export function StatusBadge({ active }: { active: boolean }) {
  return <Badge tone={active ? "forest" : "red"}>{active ? "Aktif" : "Nonaktif"}</Badge>;
}
