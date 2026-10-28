import type { Metadata } from "next";
import { AccountSettings } from "@/components/publisher/account-settings";

export const metadata: Metadata = {
  title: "Akun Sosmed",
};

export default function SocialAccountPage() {
  return <AccountSettings />;
}
