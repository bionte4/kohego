import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/access/login-form";

export const metadata: Metadata = {
  title: "Masuk",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-paper" />}>
      <LoginForm />
    </Suspense>
  );
}
