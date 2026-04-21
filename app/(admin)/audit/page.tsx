import { auth } from "@/lib/auth/config";
import { getOrCreateDefaultSite } from "@/lib/api/sites";
import { listAuditRuns } from "@/lib/api/audit";
import type { Metadata } from "next";
import { AuditDashboard } from "./dashboard";

export const metadata: Metadata = { title: "Audit Dashboard" };

export default async function AuditPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const site = await getOrCreateDefaultSite(session.user.id).catch(() => null);
  if (!site) return null;

  const { items } = await listAuditRuns(site.id, { limit: 100 });

  return <AuditDashboard items={items} siteId={site.id} />;
}
