import { z } from "zod/v4";
import type { ApiKeyContext } from "@/lib/auth/api-key";
import { requireScope } from "@/lib/auth/api-key";
import * as MediaApi from "@/lib/api/media";
import { processMediaUpload } from "@/lib/media/pipeline";
import { ApiError } from "@/lib/api/errors";

export const mediaTools = [
  {
    name: "list_media",
    description: "List media items for a site.",
    inputSchema: z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }),
    async handler(input: { limit?: number; offset?: number }, ctx: ApiKeyContext) {
      requireScope(ctx, "read");
      return MediaApi.listMedia(ctx.siteId, input.limit, input.offset);
    },
  },
  {
    name: "upload_media_from_url",
    description: "Download an image from a URL, process it, and store it.",
    inputSchema: z.object({
      url: z.string().url(),
      alt: z.string().min(1),
    }),
    async handler(input: { url: string; alt: string }, ctx: ApiKeyContext) {
      requireScope(ctx, "write");
      const res = await fetch(input.url);
      if (!res.ok) {
        throw new ApiError("provider-error", `Failed to fetch image from ${input.url}`, 400);
      }
      const blob = await res.blob();
      const buffer = Buffer.from(await blob.arrayBuffer());
      const contentType = res.headers.get("content-type") ?? "image/jpeg";
      const filename = input.url.split("/").pop() ?? "image";
      return processMediaUpload(
        { buffer, originalname: filename, mimetype: contentType, size: buffer.length },
        ctx.siteId,
        input.alt
      );
    },
  },
  {
    name: "delete_media",
    description: "Delete a media item.",
    inputSchema: z.object({ id: z.string().uuid() }),
    async handler(input: { id: string }, ctx: ApiKeyContext) {
      requireScope(ctx, "write");
      const blobKey = await MediaApi.deleteMedia(input.id, ctx.siteId);
      return { ok: true, blobKey };
    },
  },
];
