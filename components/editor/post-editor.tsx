"use client";

import { useState, useCallback, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import type { Post, Author, Tag, Category } from "@/lib/db/schema";
import { savePost, publishPostAction, runGuardrailsAction } from "./actions";
import type { GuardResult } from "@/lib/guardrails/types";
import { slugify } from "@/lib/util/slugify";

type Props = {
  siteId: string;
  post?: Post;
  authors: Author[];
  tags: Tag[];
  categories: Category[];
};

export function PostEditor({ siteId, post, authors, tags, categories }: Props) {
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [slugManual, setSlugManual] = useState(!!post);
  const [metaTitle, setMetaTitle] = useState(post?.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(post?.metaDescription ?? "");
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [authorId, setAuthorId] = useState(post?.authorId ?? "");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"metadata" | "guardrails" | "schema">("metadata");
  const [guardResults, setGuardResults] = useState<GuardResult[]>([]);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Image,
      Placeholder.configure({ placeholder: "Start writing..." }),
      CharacterCount,
    ],
    content: post?.mdxBody ?? "",
    editorProps: {
      attributes: {
        class: "prose-body focus:outline-none min-h-[400px]",
      },
    },
    onUpdate: ({ editor }) => {
      const content = editor.getText();
      // Debounced guardrail check
      debouncedGuardrailCheck(editor.getHTML());
    },
  });

  // Debounce guardrail checks
  const debouncedGuardrailCheck = useCallback(
    debounce(async (body: string) => {
      if (!post?.id) return;
      const results = await runGuardrailsAction(post.id, siteId);
      if (results) setGuardResults(results);
    }, 500),
    [post?.id, siteId]
  );

  // Auto-derive slug from title
  useEffect(() => {
    if (!slugManual && title) {
      setSlug(slugify(title));
    }
  }, [title, slugManual]);

  const handleSave = async () => {
    setSaving(true);
    const body = editor?.getHTML() ?? "";
    const result = await savePost({
      id: post?.id,
      siteId,
      title,
      slug,
      mdxBody: body,
      metaTitle,
      metaDescription,
      excerpt,
      authorId: authorId || undefined,
      tagIds: selectedTags,
    });
    setSaving(false);
    setSaveMsg(result.ok ? "Saved" : result.error ?? "Error");
    setTimeout(() => setSaveMsg(""), 2000);
  };

  const handlePublish = async () => {
    if (!post?.id) {
      setSaveMsg("Save first before publishing");
      return;
    }
    setPublishing(true);
    const result = await publishPostAction(post.id, siteId);
    setPublishing(false);
    if (!result.ok && result.issues) {
      setGuardResults(result.issues as GuardResult[]);
      setActiveTab("guardrails");
      setSaveMsg("Fix guardrail errors before publishing");
    } else if (result.ok) {
      setSaveMsg("Published!");
    }
    setTimeout(() => setSaveMsg(""), 3000);
  };

  const wordCount = editor?.storage.characterCount.words() ?? 0;
  const hasErrors = guardResults.some((r) => !r.pass && r.severity === "error");

  return (
    <div className="flex gap-6 h-full">
      {/* Main editor */}
      <div className="flex-1 min-w-0">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm text-[var(--color-text-muted)]">
            {wordCount} words
            {saveMsg && (
              <span className="ml-3 text-[var(--color-accent)] font-medium">
                {saveMsg}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-[var(--radius-md)] hover:bg-[var(--color-bg-subtle)] transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save draft"}
            </button>
            <button
              onClick={handlePublish}
              disabled={publishing || hasErrors}
              className="px-3 py-1.5 text-sm bg-[var(--color-accent)] text-white rounded-[var(--radius-md)] hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50"
              title={hasErrors ? "Fix guardrail errors to publish" : ""}
            >
              {publishing ? "Publishing…" : "Publish"}
            </button>
          </div>
        </div>

        <input
          type="text"
          placeholder="Post title…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full text-3xl font-bold text-[var(--color-text)] bg-transparent border-none outline-none mb-4 placeholder:text-[var(--color-text-muted)]"
        />

        <EditorContent editor={editor} className="min-h-[400px]" />
      </div>

      {/* Sidebar */}
      <div className="w-[280px] shrink-0">
        <div className="border border-[var(--color-border)] rounded-[var(--radius-lg)] overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-[var(--color-border)]">
            {(["metadata", "guardrails", "schema"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? "text-[var(--color-text)] border-b-2 border-[var(--color-accent)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                {tab}
                {tab === "guardrails" && hasErrors && (
                  <span className="ml-1 w-1.5 h-1.5 bg-red-500 rounded-full inline-block" />
                )}
              </button>
            ))}
          </div>

          <div className="p-4 space-y-4 text-sm">
            {activeTab === "metadata" && (
              <>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Slug</label>
                  <div className="flex gap-1">
                    <input
                      value={slug}
                      onChange={(e) => { setSlug(e.target.value); setSlugManual(true); }}
                      className="flex-1 px-2 py-1.5 text-xs border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-bg)] focus:outline-none focus:border-[var(--color-accent)]"
                    />
                    {slugManual && (
                      <button
                        onClick={() => setSlugManual(false)}
                        className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] px-1"
                        title="Re-enable auto-derive"
                      >
                        🔄
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
                    Meta title ({metaTitle.length}/60)
                  </label>
                  <input
                    value={metaTitle}
                    onChange={(e) => setMetaTitle(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-bg)] focus:outline-none focus:border-[var(--color-accent)]"
                    placeholder="30–60 characters"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
                    Meta description ({metaDescription.length}/160)
                  </label>
                  <textarea
                    value={metaDescription}
                    onChange={(e) => setMetaDescription(e.target.value)}
                    rows={3}
                    className="w-full px-2 py-1.5 text-xs border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-bg)] focus:outline-none focus:border-[var(--color-accent)] resize-none"
                    placeholder="120–160 characters"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Author</label>
                  <select
                    value={authorId}
                    onChange={(e) => setAuthorId(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-bg)] focus:outline-none focus:border-[var(--color-accent)]"
                  >
                    <option value="">No author</option>
                    {authors.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Tags</label>
                  <div className="flex flex-wrap gap-1">
                    {tags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() =>
                          setSelectedTags((prev) =>
                            prev.includes(tag.id)
                              ? prev.filter((id) => id !== tag.id)
                              : [...prev, tag.id]
                          )
                        }
                        className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                          selectedTags.includes(tag.id)
                            ? "bg-[var(--color-accent)] text-white border-transparent"
                            : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]"
                        }`}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {activeTab === "guardrails" && (
              <div className="space-y-2">
                {guardResults.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-muted)] py-4 text-center">Save a post to see guardrail results.</p>
                ) : (
                  guardResults.map((r) => (
                    <div
                      key={r.code}
                      className={`p-2 rounded-[var(--radius-sm)] text-xs ${
                        r.pass
                          ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300"
                          : r.severity === "error"
                          ? "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300"
                          : "bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
                      }`}
                    >
                      <div className="flex items-center gap-1 font-medium">
                        <span>{r.pass ? "✓" : r.severity === "error" ? "✗" : "⚠"}</span>
                        <span>{r.code}</span>
                      </div>
                      <p className="mt-0.5 text-[0.7rem] opacity-80">{r.message}</p>
                      {!r.pass && r.fix && (
                        <p className="mt-0.5 text-[0.65rem] opacity-70 italic">{r.fix}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "schema" && (
              <div className="text-xs text-[var(--color-text-muted)]">
                <p>JSON-LD preview is available after saving.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function debounce<T extends unknown[]>(fn: (...args: T) => void, delay: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: T) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
