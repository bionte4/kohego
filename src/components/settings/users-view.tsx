"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useCan } from "@/components/access/role-provider";
import { RoleBadge, StatusBadge } from "@/components/settings/role-badge";
import { UserForm } from "@/components/settings/user-form";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { guard } from "@/lib/guard";
import { getUsersClient, getUsersServer, replaceUsers, subscribeUsers } from "@/lib/users-store";
import { activeAdminCount, addUser, removeUser, updateUser, type StaffUser, type UserFormValues } from "@/lib/users";
import { isRole } from "@/lib/rbac";
import { uid } from "@/lib/utils";

export function UsersView() {
  const directory = useSyncExternalStore(subscribeUsers, getUsersClient, getUsersServer);
  const canCreate = useCan("users", "create");
  const canUpdate = useCan("users", "update");
  const canDelete = useCan("users", "delete");
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<StaffUser | null>(null);
  const [statusTarget, setStatusTarget] = useState<StaffUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [readyIds, setReadyIds] = useState<string[]>([]);
  const [pendingGoogle, setPendingGoogle] = useState<StaffUser[]>([]);

  function refreshPasswords() {
    void fetch("/api/users")
      .then((response) => response.json())
      .then((body: { readyIds?: unknown; pending?: unknown }) => {
        if (Array.isArray(body.readyIds)) setReadyIds(body.readyIds.filter((id): id is string => typeof id === "string"));
        if (Array.isArray(body.pending)) {
          setPendingGoogle(
            body.pending.flatMap((item) => {
              if (!item || typeof item !== "object") return [];
              const row = item as Partial<StaffUser>;
              if (typeof row.id !== "string" || typeof row.name !== "string" || typeof row.email !== "string" || !isRole(row.role)) return [];
              return [{ id: row.id, name: row.name, email: row.email, role: row.role, active: false, updatedAt: "" }];
            }),
          );
        }
      })
      .catch(() => undefined);
  }

  useEffect(() => {
    refreshPasswords();
  }, []);

  if (!directory) {
    return <p className="text-sm text-slate-500">Menyiapkan daftar pengguna...</p>;
  }
  const data = directory;
  const admins = activeAdminCount(data.users);
  const waiting = pendingGoogle.filter((person) => !data.users.some((user) => user.id === person.id || user.email === person.email));

  function commit(result: { ok: true; directory: typeof data } | { ok: false; message: string }) {
    if (!result.ok) return result.message;
    return replaceUsers(result.directory) ? null : "Perubahan tidak tersimpan. Penyimpanan browser penuh atau diblokir.";
  }

  async function onCreate(values: UserFormValues) {
    const id = uid("usr");
    const denied = await guard("users", "create", { id, ...values });
    if (denied) return denied;
    const current = getUsersClient();
    if (!current) return "Daftar pengguna belum siap.";
    const message = commit(addUser(current, values, id, new Date().toISOString()));
    if (!message) refreshPasswords();
    return message;
  }

  async function onAssign(userId: string, values: UserFormValues) {
    const denied = await guard("users", "update", { id: userId, ...values });
    if (denied) return denied;
    const current = getUsersClient();
    if (!current) return "Daftar pengguna belum siap.";
    const message = commit(addUser(current, values, userId, new Date().toISOString()));
    if (!message) refreshPasswords();
    return message;
  }

  async function onUpdate(userId: string, values: UserFormValues) {
    const denied = await guard("users", "update", { id: userId, ...values });
    if (denied) return denied;
    const current = getUsersClient();
    if (!current) return "Daftar pengguna belum siap.";
    const message = commit(updateUser(current, userId, values, new Date().toISOString()));
    if (!message) refreshPasswords();
    return message;
  }

  async function onRemove(user: StaffUser) {
    const denied = await guard("users", "delete", { id: user.id });
    if (denied) return denied;
    const current = getUsersClient();
    if (!current) return "Daftar pengguna belum siap.";
    return commit(removeUser(current, user.id));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-2xl text-sm leading-6 text-slate-600">
          {data.users.length} staf tercatat. {admins} super admin masih aktif. Perubahan daftar ini tersedia untuk super admin.
        </p>
        {canCreate ? (
          <Button
            onClick={() => {
              setEditing(null);
              setCreating(true);
            }}
          >
            Tambah pengguna
          </Button>
        ) : null}
      </div>
      {waiting.length > 0 ? (
        <section className="rounded-2xl border border-earth-100 bg-earth-50 p-4">
          <h2 className="font-display text-lg text-earth-900">Menunggu penetapan peran</h2>
          <p className="mt-1 mb-3 text-sm leading-6 text-earth-900">
            Akun Google baru masuk sebagai penjualan lapangan dan belum aktif. Tetapkan peran, lalu aktifkan agar mereka bisa masuk.
          </p>
          <ul className="space-y-2">
            {waiting.map((person) => (
              <li key={person.id} className="flex flex-col gap-2 rounded-xl bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  <span className="block font-semibold text-ink">{person.name}</span>
                  <span className="text-sm text-slate-600">{person.email}</span>
                </span>
                {canUpdate ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setCreating(false);
                      setEditing(person);
                    }}
                  >
                    Tetapkan peran
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-forest-50 text-forest-950">
            <tr>
              {["Nama", "Email", "Peran", "Status", "Kata sandi", ""].map((label) => (
                <th key={label || "aksi"} className="px-3 py-3 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.users.map((user) => (
              <tr key={user.id} className="border-t border-slate-200">
                <td className="px-3 py-3 font-semibold">{user.name}</td>
                <td className="px-3 py-3 text-slate-600">{user.email}</td>
                <td className="px-3 py-3">
                  <RoleBadge role={user.role} />
                </td>
                <td className="px-3 py-3">
                  <StatusBadge active={user.active} />
                </td>
                <td className="px-3 py-3 text-slate-600">{readyIds.includes(user.id) ? "Siap" : "Belum diatur"}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-2">
                    {canUpdate ? (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setCreating(false);
                          setEditing(user);
                        }}
                      >
                        Ubah
                      </Button>
                    ) : null}
                    {canUpdate ? (
                      <Button variant="secondary" onClick={() => setStatusTarget(user)}>
                        {user.active ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                    ) : null}
                    {canDelete ? (
                      <Button variant="danger" onClick={() => setRemoving(user)}>
                        Hapus
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal
        open={creating || editing !== null}
        title={editing ? (data.users.some((user) => user.id === editing.id) ? "Edit pengguna" : "Tetapkan peran") : "Tambah pengguna"}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      >
        {creating || editing ? (
          <UserForm
            key={editing?.id ?? "baru"}
            user={editing}
            onClose={() => {
              setCreating(false);
              setEditing(null);
            }}
            onSave={(values) => {
              if (!editing) return onCreate(values);
              return data.users.some((user) => user.id === editing.id) ? onUpdate(editing.id, values) : onAssign(editing.id, values);
            }}
          />
        ) : null}
      </Modal>
      <Modal open={removing !== null} title={removing ? `Hapus ${removing.name}` : "Hapus pengguna"} onClose={() => setRemoving(null)}>
        {removing ? (
          <Confirm
            body={
              removing.role === "SUPER_ADMIN" && removing.active && admins < 2
                ? "Sisakan minimal satu super admin yang aktif."
                : `${removing.name} akan keluar dari daftar staf. Pesanan yang sudah tercatat tetap ada.`
            }
            confirmLabel="Ya, hapus"
            blocked={removing.role === "SUPER_ADMIN" && removing.active && admins < 2}
            onCancel={() => setRemoving(null)}
            onConfirm={() => {
              void onRemove(removing).then((message) => {
                setError(message);
                if (!message) setRemoving(null);
              });
            }}
          />
        ) : null}
      </Modal>
      <Modal
        open={statusTarget !== null}
        title={statusTarget ? (statusTarget.active ? `Nonaktifkan ${statusTarget.name}` : `Aktifkan ${statusTarget.name}`) : "Status"}
        onClose={() => setStatusTarget(null)}
      >
        {statusTarget ? (
          <Confirm
            body={
              statusTarget.active && statusTarget.role === "SUPER_ADMIN" && admins < 2
                ? "Sisakan minimal satu super admin yang aktif."
                : statusTarget.active
                  ? `${statusTarget.name} tetap ada di daftar, dengan status nonaktif.`
                  : `${statusTarget.name} kembali berstatus aktif.`
            }
            confirmLabel={statusTarget.active ? "Ya, nonaktifkan" : "Ya, aktifkan"}
            blocked={statusTarget.active && statusTarget.role === "SUPER_ADMIN" && admins < 2}
            onCancel={() => setStatusTarget(null)}
            onConfirm={() => {
              void onUpdate(statusTarget.id, {
                name: statusTarget.name,
                email: statusTarget.email,
                role: statusTarget.role,
                active: !statusTarget.active,
              }).then((message) => {
                setError(message);
                if (!message) setStatusTarget(null);
              });
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}

function Confirm({
  body,
  confirmLabel,
  blocked,
  onCancel,
  onConfirm,
}: {
  body: string;
  confirmLabel: string;
  blocked: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-slate-600">{body}</p>
      <div className="flex flex-wrap gap-2">
        {blocked ? null : (
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        )}
        <Button variant="secondary" onClick={onCancel}>
          Batal
        </Button>
      </div>
    </div>
  );
}
