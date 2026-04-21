import { auth } from "@/lib/auth/config";
import { processMediaUpload } from "@/lib/media/pipeline";
import { getOrCreateDefaultSite } from "@/lib/api/sites";
import type { NextRequest } from "next/server";
import type { UploadFile } from "@/lib/media/pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const alt = (formData.get("alt") as string) || "";
  const siteId = (formData.get("siteId") as string) || "";

  if (!file) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const uploadFile: UploadFile = {
    buffer,
    originalname: file.name,
    mimetype: file.type,
    size: file.size,
  };

  let resolvedSiteId = siteId;
  if (!resolvedSiteId) {
    const site = await getOrCreateDefaultSite(session.user.id);
    resolvedSiteId = site.id;
  }

  const media = await processMediaUpload(uploadFile, resolvedSiteId, alt);
  return Response.json(media);
}
