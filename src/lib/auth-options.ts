import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { linkGoogleAccount } from "@/lib/credentials";
import { isRole } from "@/lib/rbac";

export function googleConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim() &&
      process.env.NEXTAUTH_SECRET?.trim(),
  );
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: { params: { prompt: "select_account" } },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return false;
      const email = profile?.email;
      const verified = profile && "email_verified" in profile ? profile.email_verified : undefined;
      if (!email || verified === false) return "/login?google=unverified";
      const linked = await linkGoogleAccount({ email, name: profile.name ?? email });
      if (linked.status === "pending") return "/login?status=menunggu";
      return true;
    },
    async jwt({ token, account, profile }) {
      if (account?.provider === "google" && profile?.email) {
        const linked = await linkGoogleAccount({ email: profile.email, name: profile.name ?? profile.email });
        if (linked.status === "ready") {
          token.userId = linked.id;
          token.role = linked.role;
          token.name = linked.name;
          token.email = linked.email;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.userId === "string" ? token.userId : "";
        if (isRole(token.role)) session.user.role = token.role;
        if (typeof token.name === "string") session.user.name = token.name;
        if (typeof token.email === "string") session.user.email = token.email;
      }
      return session;
    },
  },
};
