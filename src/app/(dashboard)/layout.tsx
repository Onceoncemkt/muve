import { AppShell } from "@/components/layout/app-shell";
import { requireAdminUser } from "@/modules/auth/guards";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireAdminUser();
  return <AppShell>{children}</AppShell>;
}
