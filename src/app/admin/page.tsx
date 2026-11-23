import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AdminApp } from "@/components/admin/admin-app";
import {
  adminCookieName,
  usingDefaultAdminPassword,
  verifyAdminSessionToken,
} from "@/lib/server/admin-auth";

export const metadata: Metadata = {
  title: "Admin Console — I Love Doc",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true,
  },
};

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(adminCookieName())?.value;
  const isAuthenticated = verifyAdminSessionToken(token);
  const usingDefault = usingDefaultAdminPassword();

  return (
    <AdminApp
      initialAuthenticated={isAuthenticated}
      usingDefaultPassword={usingDefault}
    />
  );
}
