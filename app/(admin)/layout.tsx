import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin-shell/sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  return (
    <div className="flex h-full min-h-screen">
      <AdminSidebar />
      <main className="flex-1 overflow-auto bg-[var(--color-bg)]">
        <div className="mx-auto max-w-[960px] px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
