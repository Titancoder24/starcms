import { auth } from "@/lib/auth/config";
import { getOrCreateDefaultSite } from "@/lib/api/sites";
import { listPosts } from "@/lib/api/posts";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Posts" };

export default async function PostsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const site = await getOrCreateDefaultSite(session.user.id).catch(() => null);
  if (!site) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Posts</h1>
        <p className="text-[var(--color-text-muted)]">No site configured.</p>
      </div>
    );
  }

  const { items } = await listPosts(site.id, { limit: 50 });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Posts</h1>
        <Link
          href="/admin/posts/new"
          className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-[var(--radius-md)] text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          New post
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-[var(--color-border)] rounded-[var(--radius-lg)]">
          <p className="text-[var(--color-text-muted)] mb-4">No posts yet.</p>
          <Link href="/admin/posts/new" className="text-[var(--color-accent)] text-sm font-medium hover:underline">
            Write your first post →
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-[var(--color-border)]">
          {items.map((post) => (
            <div key={post.id} className="py-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <Link
                  href={`/admin/posts/${post.id}`}
                  className="font-medium text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors truncate block"
                >
                  {post.title}
                </Link>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  /p/{post.slug} · {post.updatedAt.toLocaleDateString()}
                </p>
              </div>
              <span
                className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                  post.status === "published"
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    : post.status === "scheduled"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]"
                }`}
              >
                {post.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
