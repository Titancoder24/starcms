"use server";

import { auth } from "@/lib/auth/config";
import { triggerAudit } from "@/lib/api/audit";

export async function runAuditAction(url: string, siteId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;
  return triggerAudit(url, siteId);
}
