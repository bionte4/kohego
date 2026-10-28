import type { Metadata } from "next";
import { UsersView } from "@/components/settings/users-view";

export const metadata: Metadata = {
  title: "Pengguna",
};

export default function UsersPage() {
  return <UsersView />;
}
