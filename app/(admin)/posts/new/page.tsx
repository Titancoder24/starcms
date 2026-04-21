import type { Metadata } from "next";
import { PostEditor } from "@/components/editor/post-editor";
import { auth } from "@/lib/auth/config";
import { getOrCreateDefaultSite } from "@/lib/api/sites";
import { listAuthors } from "@/lib/api/authors";
import { listTags, listCategories } from "@/lib/api/taxonomy";

export const metadata: Metadata = { title: "New Post" };

export default async function NewPostPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const site = await getOrCreateDefaultSite(session.user.id).catch(() => null);
  if (!site) return null;

  const [authors, tags, categories] = await Promise.all([
    listAuthors(site.id),
    listTags(site.id),
    listCategories(site.id),
  ]);

  return (
    <PostEditor
      siteId={site.id}
      authors={authors}
      tags={tags}
      categories={categories}
    />
  );
}
