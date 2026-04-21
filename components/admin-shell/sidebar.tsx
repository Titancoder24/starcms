"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/admin/posts", label: "Posts", icon: "📝" },
  { href: "/admin/pages", label: "Pages", icon: "📄" },
  { href: "/admin/media", label: "Media", icon: "🖼️" },
  { href: "/admin/authors", label: "Authors", icon: "👤" },
  { href: "/admin/audit", label: "Audit", icon: "📊" },
  { href: "/admin/programmatic", label: "Programmatic", icon: "⚡" },
  { href: "/admin/settings", label: "Settings", icon: "⚙️" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="admin-sidebar flex flex-col sticky top-0 h-screen">
      <div className="p-4 border-b border-[var(--color-border)]">
        <Link href="/admin/posts" className="flex items-center gap-2 font-bold text-[var(--color-text)]">
          <span className="text-xl">★</span>
          <span className="nav-label text-sm font-semibold tracking-tight">StarCMS</span>
        </Link>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] text-sm transition-colors ${
                active
                  ? "bg-[var(--color-bg-subtle)] text-[var(--color-text)] font-medium"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text)]"
              }`}
            >
              <span className="text-base shrink-0">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-[var(--color-border)]">
        <Link
          href="/api/auth/signout"
          className="nav-label text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          Sign out
        </Link>
      </div>
    </aside>
  );
}
