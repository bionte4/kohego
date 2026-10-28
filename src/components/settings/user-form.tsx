"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { ROLE_LABEL, ROLES } from "@/lib/rbac";
import { userFormSchema, type StaffUser, type UserFormValues } from "@/lib/users";

export function UserForm({
  user,
  onClose,
  onSave,
}: {
  user: StaffUser | null;
  onClose: () => void;
  onSave: (values: UserFormValues) => Promise<string | null>;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: user
      ? { name: user.name, email: user.email, role: user.role, active: user.active }
      : { name: "", email: "", role: "FIELD_SALES", active: true },
  });

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit(async (values) => {
        setFormError(null);
        const password = values.password?.trim() ?? "";
        if (!user && password.length < 8) {
          setFormError("Isi kata sandi, minimal 8 karakter.");
          return;
        }
        if (password && password !== confirm.trim()) {
          setFormError("Ulangan kata sandi tidak sama.");
          return;
        }
        const message = await onSave({ ...values, password });
        if (message) setFormError(message);
        else onClose();
      })}
    >
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">Nama</span>
        <input className={controlClass} autoComplete="name" {...register("name")} />
        {errors.name ? <span className="mt-1.5 block text-xs text-red-700">{errors.name.message}</span> : null}
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">Email</span>
        <input className={controlClass} type="email" autoComplete="email" inputMode="email" {...register("email")} />
        {errors.email ? <span className="mt-1.5 block text-xs text-red-700">{errors.email.message}</span> : null}
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">Peran</span>
        <select className={controlClass} {...register("role")}>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABEL[role]}
            </option>
          ))}
        </select>
        {errors.role ? <span className="mt-1.5 block text-xs text-red-700">{errors.role.message}</span> : null}
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">Kata sandi</span>
        <input className={controlClass} type="password" autoComplete="new-password" {...register("password")} />
        <span className="mt-1.5 block text-xs text-slate-500">
          {user ? "Kosongkan jika kata sandi tidak diganti. Minimal 8 karakter." : "Minimal 8 karakter. Dipakai untuk masuk."}
        </span>
        {errors.password ? <span className="mt-1.5 block text-xs text-red-700">{errors.password.message}</span> : null}
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">Ulangi kata sandi</span>
        <input className={controlClass} type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
      </label>
      <label className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-300 bg-white px-3">
        <input type="checkbox" className="size-5 accent-forest-800" {...register("active")} />
        <span className="text-sm font-medium text-ink">Akun aktif</span>
      </label>
      {formError ? (
        <p role="alert" className="text-sm text-red-700">
          {formError}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSubmitting}>
          Simpan pengguna
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>
          Batal
        </Button>
      </div>
    </form>
  );
}
