import type { Metadata } from "next";
import { SignInForm } from "./form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to StarCMS",
};

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
      <div className="w-full max-w-sm px-6">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">★</div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">StarCMS</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-2">
            The CMS built to rank.
          </p>
        </div>
        <SignInForm />
      </div>
    </div>
  );
}
