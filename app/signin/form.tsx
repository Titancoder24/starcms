"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await signIn("resend", { email, redirect: false, callbackUrl: "/admin/posts" });
    setSent(true);
    setLoading(false);
  };

  return (
    <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-sm)]">
      {sent ? (
        <div className="text-center">
          <p className="font-semibold text-[var(--color-text)] mb-2">Check your email</p>
          <p className="text-sm text-[var(--color-text-muted)]">
            We sent a magic link to <strong>{email}</strong>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full px-3 py-2 border border-[var(--color-border)] rounded-[var(--radius-md)] text-sm bg-[var(--color-bg)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !email}
            className="w-full py-2 px-4 bg-[var(--color-accent)] text-white rounded-[var(--radius-md)] text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Sending…" : "Continue with email"}
          </button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[var(--color-border)]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[var(--color-bg)] px-2 text-xs text-[var(--color-text-muted)]">or</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signIn("github", { callbackUrl: "/admin/posts" })}
            className="w-full py-2 px-4 border border-[var(--color-border)] text-[var(--color-text)] rounded-[var(--radius-md)] text-sm font-medium hover:bg-[var(--color-bg-subtle)] transition-colors"
          >
            Continue with GitHub
          </button>
        </form>
      )}
    </div>
  );
}
