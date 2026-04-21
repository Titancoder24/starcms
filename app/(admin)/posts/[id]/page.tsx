import type { Metadata } from "next";
import { PostEditor } from "@/components/editor/post-editor";
import { auth } from "@/lib/auth/config";
import { getOrCreateDefaultSite } from "@/lib/api/sites";
import { getPost } from "@/lib/api/posts";
import { listAuthors } from "@/lib/api/authors";
import { listTags, listCategories } from "@/lib/api/taxonomy";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Edit Post" };

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;
  const site = await getOrCreateDefaultSite(session.user.id).catch(() => null);
  if (!site) return null;

  const [post, authors, tags, categories] = await Promise.all([
    getPost(id, site.id).catch(() => null),
    listAuthors(site.id),
    listTags(site.id),
    listCategories(site.id),
  ]);

  if (!post) notFound();

  return (
    <PostEditor
      siteId={site.id}
      post={post}
      authors={authors}
      tags={tags}
      categories={categories}
    />
  );
}
