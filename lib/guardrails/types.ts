import type { Post, Site, Author } from "@/lib/db/schema";

export type GuardResult = {
  code: string;
  pass: boolean;
  severity: "error" | "warn";
  message: string;
  fix: string;
};

export type PostForCheck = {
  post: Post;
  site: Site | null;
  author: Author | null;
  allPublishedPosts: Array<{ id: string; embedding: number[] | null }>;
  publishedPosts: Array<{ id: string; slug: string; mdxBody: string }>;
};
