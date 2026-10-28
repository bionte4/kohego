"use client";

import { Sprout } from "lucide-react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/access/role-provider";
import { isRole } from "@/lib/rbac";
import { buttonClass } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { establish } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const notice =
    params.get("status") === "menunggu"
      ? "Akun Google ini baru. Super admin perlu menetapkan peran di menu Pengguna sebelum Anda bisa masuk."
      : params.get("google") === "unverified"
        ? "Google belum mengonfirmasi email akun ini."
        : params.get("google") === "belum"
          ? "Masuk dengan Google belum diaktifkan di server."
          : params.get("error")
            ? "Masuk dengan Google tidak selesai. Coba lagi."
            : null;

  function onGoogle() {
    setGooglePending(true);
    void signIn("google", { callbackUrl: "/dashboard" });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = (await response.json().catch(() => null)) as {
        message?: string;
        role?: unknown;
        user?: { id?: string; name?: string; email?: string } | null;
      } | null;
      if (!response.ok || !isRole(body?.role) || !body.user?.id || !body.user.name || !body.user.email) {
        setError(body?.message ?? "Masuk gagal.");
        return;
      }
      establish(body.role, { id: body.user.id, name: body.user.name, email: body.user.email });
      router.replace("/dashboard");
    } catch {
      setError("Masuk gagal. Periksa koneksi, lalu coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-forest-800 text-white">
            <Sprout className="h-5 w-5" aria-hidden />
          </span>
          <span>
            <span className="block font-display text-2xl leading-none text-ink">Kohego</span>
            <span className="mt-1 block text-sm text-slate-500">Pupuk organik</span>
          </span>
        </div>
        <form onSubmit={onSubmit} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="font-display text-2xl text-ink">Masuk</h1>
          <p className="mt-1 mb-5 text-sm leading-6 text-slate-600">Gunakan akun staf. Menu mengikuti peran akun tersebut.</p>
          {notice ? (
            <p role="status" className="mb-4 rounded-xl bg-earth-50 px-3 py-3 text-sm leading-6 text-earth-900">
              {notice}
            </p>
          ) : null}
          <button type="button" className={buttonClass("secondary", "w-full")} onClick={onGoogle} disabled={googlePending}>
            <GoogleMark />
            {googlePending ? "Menghubungkan Google..." : "Masuk dengan Google"}
          </button>
          <div className="my-4 flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            atau
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <div className="space-y-4">
            <Field label="Email">
              <TextInput
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </Field>
            <Field label="Kata sandi">
              <TextInput
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </Field>
          </div>
          {error ? (
            <p role="alert" className="mt-4 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <button type="submit" className={buttonClass("primary", "mt-5 w-full")} disabled={pending}>
            {pending ? "Memeriksa..." : "Masuk"}
          </button>
        </form>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}
